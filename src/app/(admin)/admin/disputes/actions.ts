"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseOrder, refundOrder } from "@/lib/escrow/settle";

/**
 * Dispute resolution is one of the two moves out of `disputed`, and both of
 * them move money. The settlement runs first and the dispute row is closed
 * afterwards, so a Stripe failure leaves the dispute open rather than closing
 * it over a refund that never happened.
 */

export type ResolveState = { error?: string };

export async function resolveDispute(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const admin = await requireRole("admin");
  const disputeId = String(formData.get("disputeId"));
  const orderId = String(formData.get("orderId"));
  const resolution = String(formData.get("resolution"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (resolution !== "released" && resolution !== "refunded") {
    return { error: "Resolve in favour of the provider or the buyer." };
  }
  if (reason.length < 10) {
    return { error: "Both parties see this reason — write at least a sentence." };
  }

  try {
    if (resolution === "released") {
      await releaseOrder({ orderId, actor: "admin", actorId: admin.id, reason });
    } else {
      await refundOrder({ orderId, actor: "admin", actorId: admin.id, reason });
    }

    await createAdminClient()
      .from("disputes")
      .update({
        status: "resolved",
        resolution,
        resolution_reason: reason,
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", disputeId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not resolve the dispute" };
  }

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${disputeId}`);
  return {};
}
