import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EscrowTimeline, type TimelineEvent } from "@/components/escrow/timeline";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { OrderState } from "@/lib/escrow/machine";
import { ResolveForm } from "./resolve-form";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputePage({ params }: PageProps<"/admin/disputes/[id]">) {
  const { id } = await params;
  await requireRole("admin");
  const supabase = await createClient();

  const { data: dispute } = await supabase
    .from("disputes")
    .select(
      `id, reason, status, resolution, resolution_reason, created_at, resolved_at,
       raised_by,
       orders(id, state, service_fee_cents, platform_fee_cents, total_cents, commission_cents,
              buyer_id, provider_id, request_id,
              requests(title, description, location_label),
              provider_profiles(business_name))`,
    )
    .eq("id", id)
    .single();

  if (!dispute) notFound();

  const order = dispute.orders as unknown as {
    id: string;
    state: OrderState;
    total_cents: number;
    commission_cents: number;
    buyer_id: string;
    provider_id: string;
    request_id: string;
    requests: { title: string; description: string; location_label: string };
    provider_profiles: { business_name: string };
  };

  const [{ data: events }, { data: parties }, { data: messages }] = await Promise.all([
    supabase
      .from("order_events")
      .select("id, from_state, to_state, actor, reason, created_at")
      .eq("order_id", order.id)
      .order("id"),
    supabase.from("profiles").select("id, full_name").in("id", [order.buyer_id, dispute.raised_by]),
    supabase
      .from("messages")
      .select("id, body, sender_id, created_at")
      .eq("request_id", order.request_id)
      // A request can carry a thread per provider; only this order's is evidence.
      .eq("provider_id", order.provider_id)
      .order("created_at")
      .limit(50),
  ]);

  const names = new Map(parties?.map((p) => [p.id, p.full_name]) ?? []);
  const buyerName = names.get(order.buyer_id) ?? "the buyer";
  const raisedBy = dispute.raised_by === order.buyer_id ? buyerName : order.provider_profiles.business_name;

  return (
    <div className="py-6">
      <Link href="/admin/disputes" className="font-mono text-[11.5px] text-faint hover:text-signal">
        ← All disputes
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold">{order.requests.title}</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {order.provider_profiles.business_name} · {buyerName} · {order.requests.location_label}
          </p>
        </div>
        <Badge tone={dispute.status === "open" ? "danger" : "muted"}>
          {dispute.resolution ?? dispute.status}
        </Badge>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Panel className="mb-4 border-danger/40">
            <SectionLabel className="mb-1.5">Raised by {raisedBy}</SectionLabel>
            <p className="text-[13px] leading-relaxed">{dispute.reason}</p>
            <p className="mt-2 font-mono text-[10.5px] text-faint">
              {formatDateTime(dispute.created_at)}
            </p>
          </Panel>

          {dispute.status === "open" ? (
            <>
              <SectionLabel className="mb-2">Resolve</SectionLabel>
              <ResolveForm
                disputeId={dispute.id}
                orderId={order.id}
                providerName={order.provider_profiles.business_name}
                buyerName={buyerName}
              />
            </>
          ) : (
            <Panel>
              <SectionLabel className="mb-1.5">
                Resolved — {dispute.resolution}
              </SectionLabel>
              <p className="text-[12.5px] text-muted">{dispute.resolution_reason}</p>
              {dispute.resolved_at && (
                <p className="mt-2 font-mono text-[10.5px] text-faint">
                  {formatDateTime(dispute.resolved_at)}
                </p>
              )}
            </Panel>
          )}

          <SectionLabel className="mb-1 mt-6">Escrow history</SectionLabel>
          <EscrowTimeline events={(events ?? []) as TimelineEvent[]} state={order.state} />
        </div>

        <div>
          <Panel>
            <SectionLabel className="mb-2.5">Amounts</SectionLabel>
            <Row label="Buyer paid" value={formatNzd(order.total_cents)} />
            <Row label="Commission" value={formatNzd(order.commission_cents)} />
            <Row
              label="Provider would receive"
              value={formatNzd(order.total_cents - order.commission_cents)}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              A refund returns the full {formatNzd(order.total_cents)}, commission included.
            </p>
          </Panel>

          <Panel className="mt-4">
            <SectionLabel className="mb-2.5">Thread</SectionLabel>
            {!messages?.length ? (
              <p className="text-[12px] text-faint">No messages on this request.</p>
            ) : (
              <ul className="max-h-[420px] space-y-2.5 overflow-y-auto scrollbar-none">
                {messages.map((m) => (
                  <li key={m.id} className="text-[12px]">
                    <span className="font-mono text-[10.5px] text-faint">
                      {m.sender_id === order.buyer_id ? buyerName : order.provider_profiles.business_name}
                      {" · "}
                      {formatDateTime(m.created_at)}
                    </span>
                    <p className="mt-0.5 text-muted">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
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
      <span className="font-mono">{value}</span>
    </div>
  );
}
