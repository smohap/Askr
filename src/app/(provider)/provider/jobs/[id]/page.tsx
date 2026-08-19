import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EscrowTimeline, type TimelineEvent } from "@/components/escrow/timeline";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { OrderState } from "@/lib/escrow/machine";
import { JobActions } from "./job-actions";

export const metadata: Metadata = { title: "Job" };

export default async function ProviderJobPage({ params }: PageProps<"/provider/jobs/[id]">) {
  const { id } = await params;
  const provider = await requireProvider();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, state, service_fee_cents, platform_fee_cents, total_cents, commission_cents,
       request_id, created_at,
       requests(title, description, location_label, needed_by),
       profiles!orders_buyer_id_fkey(full_name)`,
    )
    .eq("id", id)
    .eq("provider_id", provider.providerId)
    .single();

  if (!order) notFound();

  const { data: events } = await supabase
    .from("order_events")
    .select("id, from_state, to_state, actor, reason, created_at")
    .eq("order_id", id)
    .order("id");

  const state = order.state as OrderState;
  const request = order.requests as unknown as {
    title: string;
    description: string;
    location_label: string;
    needed_by: string | null;
  };
  const buyer = order.profiles as unknown as { full_name: string } | null;
  const payout = order.total_cents - order.commission_cents;

  return (
    <div className="py-6">
      <Link href="/provider/jobs" className="font-mono text-[11.5px] text-faint hover:text-signal">
        ← All jobs
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold">{request.title}</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {buyer?.full_name ?? "Buyer"} · {request.location_label}
            {request.needed_by && ` · ${formatDateTime(request.needed_by)}`}
          </p>
        </div>
        <Badge tone={state === "disputed" ? "danger" : "signal"}>{state.replace(/_/g, " ")}</Badge>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <SectionLabel className="mb-1">Progress</SectionLabel>
          <EscrowTimeline events={(events ?? []) as TimelineEvent[]} state={state} />
          <JobActions orderId={id} state={state} />
        </div>

        <div>
          <Panel>
            <SectionLabel className="mb-2.5">Your payout</SectionLabel>
            <Row label="Buyer pays" value={formatNzd(order.total_cents)} />
            <Row label="Platform commission" value={`− ${formatNzd(order.commission_cents)}`} />
            <div className="mt-1.5 flex justify-between border-t border-grid pt-3 text-[15px] font-semibold">
              <span>You receive</span>
              <span className="font-mono text-signal">{formatNzd(payout)}</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              {state === "released"
                ? "Transferred to your Stripe account."
                : "Held in escrow until the buyer confirms the job is done."}
            </p>
          </Panel>

          <Panel className="mt-4">
            <SectionLabel className="mb-2">The request</SectionLabel>
            <p className="text-[12.5px] text-muted">{request.description}</p>
            <Link
              href={`/provider/feed/${order.request_id}/chat`}
              className="mt-3 block font-mono text-[11.5px] text-faint hover:text-signal"
            >
              Open chat →
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px] text-muted">
      <span>{label}</span>
      <span className="text-right font-mono">{value}</span>
    </div>
  );
}
