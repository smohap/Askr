import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseEscrow, refundEscrow } from "@/lib/stripe/escrow";
import { transition, type Order } from "./transition";
import type { Actor } from "./machine";

/**
 * The two transitions that move money.
 *
 * Stripe runs first and the transition records what it returned. The other
 * order — ledger first, money second — can leave an order marked `released`
 * with nothing transferred, and there is no way to tell that apart from a
 * successful release afterwards. This way a failure leaves the order where it
 * was, and the retry is safe because both Stripe calls carry an idempotency
 * key derived from the order id.
 */

export async function getOrder(orderId: string): Promise<Order> {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!data) throw new Error(`Order ${orderId} not found`);
  return data as Order;
}

type Settlement = {
  orderId: string;
  actor: Extract<Actor, "buyer" | "admin">;
  actorId: string;
  reason?: string | null;
};

/** Transfer the provider's share, then move the order to released. */
export async function releaseOrder({ orderId, actor, actorId, reason = null }: Settlement) {
  const admin = createAdminClient();
  const order = await getOrder(orderId);

  const { data: provider } = await admin
    .from("provider_profiles")
    .select("id, business_name, user_id, stripe_account_id, jobs_completed")
    .eq("id", order.provider_id)
    .single();

  if (!provider?.stripe_account_id) {
    throw new Error(
      `${provider?.business_name ?? "This provider"} has not finished payout setup, so the payment cannot be released yet.`,
    );
  }

  const payoutCents = order.total_cents - order.commission_cents;
  const transferId = await releaseEscrow(order, payoutCents, provider.stripe_account_id);

  const released = await transition({
    orderId,
    to: "released",
    actor,
    actorId,
    reason,
    payload: {
      transfer_id: transferId,
      payout_cents: payoutCents,
      commission_cents: order.commission_cents,
    },
    patch: { stripe_transfer_id: transferId, stripe_account_id: provider.stripe_account_id },
  });

  await admin
    .from("provider_profiles")
    .update({ jobs_completed: provider.jobs_completed + 1 })
    .eq("id", provider.id);

  await admin.from("requests").update({ status: "completed" }).eq("id", order.request_id);

  await admin.from("notifications").insert({
    user_id: provider.user_id,
    type: "payment_released",
    title: "Payment released",
    body: "The buyer confirmed the job. Your payout is on its way.",
    link: `/provider/jobs/${orderId}`,
  });

  return released;
}

/** Refund the buyer in full, then move the order to refunded. */
export async function refundOrder({ orderId, actor, actorId, reason = null }: Settlement) {
  const admin = createAdminClient();
  const order = await getOrder(orderId);

  const refundId = await refundEscrow(order);

  const refunded = await transition({
    orderId,
    to: "refunded",
    actor,
    actorId,
    reason,
    payload: { refund_id: refundId, refunded_cents: order.total_cents },
  });

  await admin.from("requests").update({ status: "cancelled" }).eq("id", order.request_id);

  const { data: provider } = await admin
    .from("provider_profiles")
    .select("user_id")
    .eq("id", order.provider_id)
    .single();

  if (provider) {
    await admin.from("notifications").insert({
      user_id: provider.user_id,
      type: "order_refunded",
      title: "Order refunded",
      body: reason ?? "The escrowed payment was returned to the buyer.",
      link: `/provider/jobs/${orderId}`,
    });
  }

  return refunded;
}
