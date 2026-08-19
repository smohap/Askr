"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProvider } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { offerInput, parseEta } from "@/lib/validation/offer";
import { parseDollarsToCents } from "@/lib/validation/request";

export type OfferFormState = { error?: string };

/**
 * Submit an offer. RLS does the real gating — offers_insert_provider requires a
 * verified provider, a published request and a matching broadcast row — so this
 * only has to shape and validate the input.
 */
export async function submitOffer(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  const provider = await requireProvider();

  if (provider.verificationStatus !== "verified") {
    return { error: "Your account has to be verified before you can send offers." };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const termsRaw = formData.get("terms");

  const parsed = offerInput.safeParse({
    requestId,
    priceCents: parseDollarsToCents(formData.get("priceDollars")),
    description: formData.get("description"),
    etaMinutes: parseEta(formData.get("etaHours"), formData.get("etaMinutes")),
    warrantyMonths: Number(formData.get("warrantyMonths") ?? 0),
    terms: typeof termsRaw === "string" && termsRaw.trim() !== "" ? termsRaw : null,
    expiresInHours: Number(formData.get("expiresInHours") ?? 24),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3_600_000).toISOString();

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      request_id: parsed.data.requestId,
      provider_id: provider.providerId,
      price_cents: parsed.data.priceCents,
      description: parsed.data.description,
      eta_minutes: parsed.data.etaMinutes,
      warranty_months: parsed.data.warrantyMonths,
      terms: parsed.data.terms,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    // The partial unique index is the one failure a provider can actually cause.
    if (error.code === "23505") {
      return { error: "You already have a live offer on this request. Withdraw it to re-offer." };
    }
    return { error: error.message };
  }

  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const file of files) {
    const path = `${offer.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("offer-attachments")
      .upload(path, file, { contentType: file.type });

    if (uploadError) continue;

    await supabase
      .from("offer_attachments")
      .insert({ offer_id: offer.id, storage_path: path, mime_type: file.type });
  }

  await notifyBuyer(parsed.data.requestId, provider.businessName);

  revalidatePath("/provider/offers");
  redirect(`/provider/offers?sent=1`);
}

/**
 * Withdrawing frees the partial unique index slot, which is how a provider
 * revises a price — Phase 1 has no counter-offer flow by design.
 */
export async function withdrawOffer(offerId: string) {
  const provider = await requireProvider();
  const supabase = await createClient();

  await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("id", offerId)
    .eq("provider_id", provider.providerId)
    .eq("status", "active");

  revalidatePath("/provider/offers");
}

/** Buyers are notified as the service role: they cannot be written to by a provider. */
async function notifyBuyer(requestId: string, businessName: string) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("requests")
    .select("buyer_id, title")
    .eq("id", requestId)
    .single();

  if (!request) return;

  await admin.from("notifications").insert({
    user_id: request.buyer_id,
    type: "offer_received",
    title: `New offer from ${businessName}`,
    body: request.title,
    link: `/requests/${requestId}`,
  });
}
