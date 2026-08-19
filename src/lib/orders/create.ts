import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteToAmounts } from "@/lib/money";

/**
 * Accept an offer: create the order, close the request, and reject the losers.
 *
 * Runs as the service role because orders has no insert policy — participants
 * read orders, nothing writes them from a client session.
 *
 * The order starts at pending_payment with a genesis order_events row
 * (from_state null). It moves no further until Stripe says the money arrived.
 */
export async function acceptOffer(offerId: string, buyerId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: offer, error } = await admin
    .from("offers")
    .select("id, request_id, provider_id, price_cents, status, expires_at, requests(buyer_id, status)")
    .eq("id", offerId)
    .single();

  if (error || !offer) throw new Error("Offer not found");

  const request = offer.requests as unknown as { buyer_id: string; status: string };

  if (request.buyer_id !== buyerId) throw new Error("That is not your request");
  if (offer.status !== "active") throw new Error("That offer is no longer live");
  if (Date.parse(offer.expires_at) < Date.now()) throw new Error("That offer has expired");
  if (request.status !== "published") throw new Error(`This request is already ${request.status}`);

  const amounts = quoteToAmounts(offer.price_cents);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      request_id: offer.request_id,
      offer_id: offer.id,
      buyer_id: buyerId,
      provider_id: offer.provider_id,
      state: "pending_payment",
      service_fee_cents: amounts.serviceFeeCents,
      platform_fee_cents: amounts.platformFeeCents,
      total_cents: amounts.totalCents,
      commission_cents: amounts.commissionCents,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // request_id and offer_id are both unique, so a double-accept lands here.
    if (orderError?.code === "23505") throw new Error("This request already has an order");
    throw orderError ?? new Error("Could not create the order");
  }

  // Genesis row. Every later row is written by apply_order_transition; this one
  // has no from-state because the order did not exist before it.
  await admin.from("order_events").insert({
    order_id: order.id,
    from_state: null,
    to_state: "pending_payment",
    actor: "buyer",
    actor_id: buyerId,
    reason: "Offer accepted",
    payload: { offer_id: offer.id, price_cents: offer.price_cents },
  });

  await admin.from("offers").update({ status: "accepted" }).eq("id", offer.id);

  await admin
    .from("offers")
    .update({ status: "rejected" })
    .eq("request_id", offer.request_id)
    .eq("status", "active")
    .neq("id", offer.id);

  await admin.from("requests").update({ status: "awarded" }).eq("id", offer.request_id);

  const { data: provider } = await admin
    .from("provider_profiles")
    .select("user_id, business_name")
    .eq("id", offer.provider_id)
    .single();

  if (provider) {
    await admin.from("notifications").insert({
      user_id: provider.user_id,
      type: "offer_accepted",
      title: "Your offer was accepted",
      body: "The buyer is paying into escrow now.",
      link: `/provider/jobs/${order.id}`,
    });
  }

  return order.id;
}

/** Reject one offer without closing the request — the rest stay live. */
export async function rejectOffer(offerId: string, buyerId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: offer } = await admin
    .from("offers")
    .select("id, request_id, requests(buyer_id)")
    .eq("id", offerId)
    .single();

  if (!offer) return;

  const request = offer.requests as unknown as { buyer_id: string };
  if (request.buyer_id !== buyerId) throw new Error("That is not your request");

  await admin.from("offers").update({ status: "rejected" }).eq("id", offerId).eq("status", "active");
}
