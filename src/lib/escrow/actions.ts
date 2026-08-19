"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, requireProvider } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEscrowCheckout } from "@/lib/stripe/escrow";
import { transition } from "./transition";
import { getOrder, releaseOrder, refundOrder } from "./settle";

/**
 * Every escrow affordance the buyer and the provider have.
 *
 * Each one checks that this viewer is actually the party it claims to be on
 * this order; the machine then decides whether the move is legal from where the
 * order currently is. Neither check is redundant — the first stops a stranger,
 * the second stops a participant clicking the same button twice.
 */

export type EscrowState = { error?: string };

const failed = (e: unknown, fallback: string): EscrowState => ({
  error: e instanceof Error ? e.message : fallback,
});

/** Hand the buyer to Stripe. The order does not move until the webhook fires. */
export async function startCheckout(
  _prev: EscrowState,
  formData: FormData,
): Promise<EscrowState> {
  const viewer = await requireRole("buyer");
  const orderId = String(formData.get("orderId"));

  let url: string;
  try {
    const order = await getOrder(orderId);
    if (order.buyer_id !== viewer.id) return { error: "That is not your order" };
    if (order.state !== "pending_payment") {
      return { error: `This order is already ${order.state.replace(/_/g, " ")}` };
    }

    const admin = createAdminClient();
    const [{ data: request }, { data: provider }] = await Promise.all([
      admin.from("requests").select("title").eq("id", order.request_id).single(),
      admin.from("provider_profiles").select("business_name").eq("id", order.provider_id).single(),
    ]);

    const session = await createEscrowCheckout(order, {
      requestTitle: request?.title ?? "Servuber job",
      providerName: provider?.business_name ?? "your provider",
    });

    if (!session.url) return { error: "Stripe did not return a payment page" };
    url = session.url;
  } catch (e) {
    return failed(e, "Could not start the payment");
  }

  redirect(url);
}

export async function startJob(_prev: EscrowState, formData: FormData): Promise<EscrowState> {
  const provider = await requireProvider();
  const orderId = String(formData.get("orderId"));

  try {
    const order = await getOrder(orderId);
    if (order.provider_id !== provider.providerId) return { error: "That is not your job" };

    await transition({
      orderId,
      to: "in_progress",
      actor: "provider",
      actorId: provider.id,
      reason: "Provider started the job",
    });
  } catch (e) {
    return failed(e, "Could not start the job");
  }

  revalidatePath(`/provider/jobs/${orderId}`);
  return {};
}

export async function markDelivered(_prev: EscrowState, formData: FormData): Promise<EscrowState> {
  const provider = await requireProvider();
  const orderId = String(formData.get("orderId"));

  try {
    const order = await getOrder(orderId);
    if (order.provider_id !== provider.providerId) return { error: "That is not your job" };

    await transition({
      orderId,
      to: "awaiting_confirmation",
      actor: "provider",
      actorId: provider.id,
      reason: "Provider marked the job delivered",
    });

    const admin = createAdminClient();
    const { data: buyer } = await admin
      .from("orders")
      .select("buyer_id")
      .eq("id", orderId)
      .single();

    if (buyer) {
      await admin.from("notifications").insert({
        user_id: buyer.buyer_id,
        type: "job_delivered",
        title: "Your job is done",
        body: "Confirm completion to release the payment from escrow.",
        link: `/orders/${orderId}`,
      });
    }
  } catch (e) {
    return failed(e, "Could not mark the job delivered");
  }

  revalidatePath(`/provider/jobs/${orderId}`);
  return {};
}

/** The buyer confirms: the transfer fires and the order becomes terminal. */
export async function confirmCompletion(
  _prev: EscrowState,
  formData: FormData,
): Promise<EscrowState> {
  const viewer = await requireRole("buyer");
  const orderId = String(formData.get("orderId"));

  try {
    const order = await getOrder(orderId);
    if (order.buyer_id !== viewer.id) return { error: "That is not your order" };

    await releaseOrder({
      orderId,
      actor: "buyer",
      actorId: viewer.id,
      reason: "Buyer confirmed the job was completed",
    });
  } catch (e) {
    return failed(e, "Could not release the payment");
  }

  redirect(`/orders/${orderId}/review`);
}

/** Only legal before the provider starts — the machine enforces that, not this. */
export async function cancelBeforeStart(
  _prev: EscrowState,
  formData: FormData,
): Promise<EscrowState> {
  const viewer = await requireRole("buyer");
  const orderId = String(formData.get("orderId"));

  try {
    const order = await getOrder(orderId);
    if (order.buyer_id !== viewer.id) return { error: "That is not your order" };

    await refundOrder({
      orderId,
      actor: "buyer",
      actorId: viewer.id,
      reason: "Buyer cancelled before the job started",
    });
  } catch (e) {
    return failed(e, "Could not cancel the order");
  }

  revalidatePath(`/orders/${orderId}`);
  return {};
}

/**
 * Either party may dispute. The dispute row is what the admin console works
 * from; the order state is what stops the money moving in the meantime.
 */
export async function raiseDispute(_prev: EscrowState, formData: FormData): Promise<EscrowState> {
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (reason.length < 10) {
    return { error: "Give the admin something to work from — at least a sentence." };
  }

  const viewer = await requireRole(
    String(formData.get("as")) === "provider" ? "provider" : "buyer",
  );

  try {
    const order = await getOrder(orderId);
    const mine =
      viewer.role === "buyer"
        ? order.buyer_id === viewer.id
        : order.provider_id === viewer.providerId;

    if (!mine) return { error: "That is not your order" };

    // The transition runs first because it is the narrower gate: disputed is
    // not reachable from disputed, so an order can only pick up one dispute row
    // and the partial unique index never has to fire.
    await transition({
      orderId,
      to: "disputed",
      actor: viewer.role === "buyer" ? "buyer" : "provider",
      actorId: viewer.id,
      reason,
    });

    const admin = createAdminClient();
    await admin.from("disputes").insert({
      order_id: orderId,
      raised_by: viewer.id,
      reason,
    });
  } catch (e) {
    return failed(e, "Could not raise the dispute");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/provider/jobs/${orderId}`);
  return {};
}
