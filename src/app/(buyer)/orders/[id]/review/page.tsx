import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Leave a review" };

/** Mockup screen 10 — the confirmation and the review are one screen. */
export default async function ReviewPage({ params }: PageProps<"/orders/[id]/review">) {
  const { id } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, state, total_cents, provider_profiles(business_name)")
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!order) notFound();
  if (order.state !== "released") redirect(`/orders/${id}`);

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", id)
    .maybeSingle();

  if (existing) redirect(`/orders/${id}`);

  const provider = order.provider_profiles as unknown as { business_name: string };

  return (
    <div className="px-6 pb-12 pt-[50px] text-center">
      <div className="mb-2.5 text-[40px]">✅</div>
      <h1 className="font-display text-[21px] font-semibold">Job complete</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {formatNzd(order.total_cents)} released to {provider.business_name}
      </p>

      <div className="mt-6 text-left">
        <ReviewForm orderId={id} />
      </div>
    </div>
  );
}
