import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BroadcastResult = { matched: number };

/** Shape returned by askr.match_providers. Hand-written until typegen can run. */
type ProviderMatch = { provider_id: string; distance_km: number };

/**
 * Publish a request and fan it out to every matching provider.
 *
 * Runs as the service role for one reason: request_broadcasts has no insert
 * policy. Rows in that table are what grant a provider read access to the
 * request, so letting a client write them would let anyone grant themselves
 * access to any request.
 */
export async function publishRequest(requestId: string, buyerId: string): Promise<BroadcastResult> {
  const admin = createAdminClient();

  // Re-read under the service role but still scoped to the buyer, so a stolen
  // request id cannot publish someone else's draft.
  const { data: request, error: readError } = await admin
    .from("requests")
    .select("id, title, status, buyer_id")
    .eq("id", requestId)
    .eq("buyer_id", buyerId)
    .single();

  if (readError || !request) throw new Error("Request not found");
  if (request.status !== "draft" && request.status !== "published") {
    throw new Error(`A ${request.status} request cannot be published`);
  }

  const { error: publishError } = await admin
    .from("requests")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", requestId);

  if (publishError) throw publishError;

  const { data: matches, error: matchError } = await admin.rpc("match_providers", {
    p_request_id: requestId,
  });

  if (matchError) throw matchError;

  const providers = (matches ?? []) as ProviderMatch[];
  if (providers.length === 0) return { matched: 0 };

  // Idempotent: re-publishing an already-broadcast request adds only new matches.
  const { error: broadcastError } = await admin.from("request_broadcasts").upsert(
    providers.map((m) => ({
      request_id: requestId,
      provider_id: m.provider_id,
      distance_km: m.distance_km,
    })),
    { onConflict: "request_id,provider_id", ignoreDuplicates: true },
  );

  if (broadcastError) throw broadcastError;

  const { data: providerUsers } = await admin
    .from("provider_profiles")
    .select("user_id")
    .in(
      "id",
      providers.map((m) => m.provider_id),
    );

  if (providerUsers?.length) {
    await admin.from("notifications").insert(
      providerUsers.map((p) => ({
        user_id: p.user_id,
        type: "request_broadcast",
        title: "New request in your area",
        body: request.title,
        link: `/provider/feed/${requestId}`,
      })),
    );
  }

  return { matched: providers.length };
}
