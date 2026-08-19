"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProvider, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Reviews run through the user's own session, not the service role. The policy
 * `reviews_insert_buyer` already requires that the order is this buyer's and
 * that it reached `released`, so the database is the check — there is nothing
 * for this code to re-verify.
 */

export type ReviewState = { error?: string };

export async function submitReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const viewer = await requireRole("buyer");
  const orderId = String(formData.get("orderId"));
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from one to five stars." };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, request_id, provider_id, state")
    .eq("id", orderId)
    .eq("buyer_id", viewer.id)
    .single();

  if (!order) return { error: "That is not your order" };
  if (order.state !== "released") {
    return { error: "You can review a job once the payment has been released." };
  }

  const { error } = await supabase.from("reviews").insert({
    order_id: order.id,
    request_id: order.request_id,
    buyer_id: viewer.id,
    provider_id: order.provider_id,
    rating,
    body,
  });

  // order_id is unique on reviews — one review per job, not per opinion.
  if (error?.code === "23505") return { error: "You have already reviewed this job." };
  if (error) return { error: error.message };

  redirect("/requests");
}

/**
 * The provider's right of reply. The reviews_reply_provider policy lets them
 * update their own reviews and guard_review_reply() puts rating and body back
 * to what they were, so a reply cannot quietly rewrite the review it answers.
 */
export async function replyToReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  await requireProvider();
  const reviewId = String(formData.get("reviewId"));
  const reply = String(formData.get("reply") ?? "").trim();

  if (!reply) return { error: "Write something before posting the reply." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("reviews")
    .update({ reply_body: reply, replied_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/provider/reviews");
  return {};
}
