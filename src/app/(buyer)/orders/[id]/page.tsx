import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EscrowTimeline, type TimelineEvent } from "@/components/escrow/timeline";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel, TopBar } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { OrderState } from "@/lib/escrow/machine";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Order status" };

const TONE: Record<OrderState, "signal" | "amber" | "danger" | "muted"> = {
  pending_payment: "amber",
  escrow_held: "signal",
  in_progress: "signal",
  awaiting_confirmation: "amber",
  released: "signal",
  refunded: "muted",
  disputed: "danger",
  cancelled: "muted",
};

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  // RLS restricts orders to their participants, so a stranger's order reads as
  // missing rather than forbidden — which is what we want it to look like.
  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, state, service_fee_cents, platform_fee_cents, total_cents, request_id,
       requests(title),
       provider_profiles(business_name)`,
    )
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!order) notFound();

  const [{ data: events }, { data: review }] = await Promise.all([
    supabase
      .from("order_events")
      .select("id, from_state, to_state, actor, reason, created_at")
      .eq("order_id", id)
      .order("id"),
    supabase.from("reviews").select("id").eq("order_id", id).maybeSingle(),
  ]);

  const state = order.state as OrderState;
  const request = order.requests as unknown as { title: string };
  const provider = order.provider_profiles as unknown as { business_name: string };

  return (
    <>
      <TopBar title="Order status" backHref="/requests" />

      <div className="px-5 py-[18px]">
        <Panel className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold">{request.title}</div>
              <div className="mt-0.5 text-[12px] text-muted">{provider.business_name}</div>
            </div>
            <Badge tone={TONE[state]}>{state.replace(/_/g, " ")}</Badge>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between border-t border-grid pt-3">
            <SectionLabel>{state === "released" ? "Released" : "In escrow"}</SectionLabel>
            <span className="font-mono text-[18px] font-semibold text-signal">
              {formatNzd(order.total_cents)}
            </span>
          </div>
        </Panel>

        <SectionLabel className="mb-1">Progress</SectionLabel>
        <EscrowTimeline events={(events ?? []) as TimelineEvent[]} state={state} />

        {state === "pending_payment" && (
          <ButtonLink href={`/orders/${id}/pay`} className="mt-6">
            Pay & confirm →
          </ButtonLink>
        )}

        {state === "released" && !review && (
          <ButtonLink href={`/orders/${id}/review`} className="mt-6">
            Leave a review →
          </ButtonLink>
        )}

        {state === "disputed" && (
          <p className="mt-6 rounded-[10px] border border-danger bg-danger/10 px-3.5 py-3 text-[12.5px] text-danger">
            This order is with an admin. The escrowed payment stays put until they decide.
          </p>
        )}

        <OrderActions orderId={id} state={state} />

        <Link
          href={`/requests/${order.request_id}`}
          className="mt-6 block text-center font-mono text-[11.5px] text-faint hover:text-signal"
        >
          Back to the request
        </Link>
      </div>
    </>
  );
}
