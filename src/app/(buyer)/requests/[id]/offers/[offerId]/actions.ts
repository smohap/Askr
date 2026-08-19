"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { acceptOffer, rejectOffer } from "@/lib/orders/create";

export type DecisionState = { error?: string };

/**
 * Accepting creates the order at pending_payment and sends the buyer to pay.
 * No money has moved yet — only the Stripe webhook may say that it has.
 */
export async function accept(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const viewer = await requireRole("buyer");
  const offerId = String(formData.get("offerId"));
  const requestId = String(formData.get("requestId"));

  let orderId: string;
  try {
    orderId = await acceptOffer(offerId, viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not accept that offer" };
  }

  revalidatePath(`/requests/${requestId}`);
  redirect(`/orders/${orderId}/pay`);
}

export async function reject(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const viewer = await requireRole("buyer");
  const offerId = String(formData.get("offerId"));
  const requestId = String(formData.get("requestId"));

  try {
    await rejectOffer(offerId, viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reject that offer" };
  }

  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}
