import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Disputes" };

export default async function DisputesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: disputes } = await supabase
    .from("disputes")
    .select(
      `id, reason, status, resolution, created_at, resolved_at,
       orders(id, state, total_cents, requests(title), provider_profiles(business_name))`,
    )
    .order("created_at", { ascending: false });

  if (!disputes?.length) {
    return (
      <div className="py-8">
        <EmptyState title="No disputes" hint="Nothing has been escalated." />
      </div>
    );
  }

  const open = disputes.filter((d) => d.status === "open");
  const closed = disputes.filter((d) => d.status !== "open");

  return (
    <div className="py-6">
      <h1 className="mb-5 font-display text-[20px] font-semibold">
        Disputes
        <span className="ml-2.5 font-mono text-[13px] font-normal text-faint">
          {open.length} open
        </span>
      </h1>

      {open.length > 0 && (
        <>
          <SectionLabel className="mb-2">Open</SectionLabel>
          <div className="mb-6 grid gap-2.5">
            {open.map((d) => (
              <DisputeRow key={d.id} dispute={d} />
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <SectionLabel className="mb-2">Resolved</SectionLabel>
          <div className="grid gap-2.5">
            {closed.map((d) => (
              <DisputeRow key={d.id} dispute={d} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type DisputeSummary = {
  id: string;
  reason: string;
  status: string;
  resolution: string | null;
  created_at: string;
  orders: unknown;
};

function DisputeRow({ dispute }: { dispute: DisputeSummary }) {
  const order = dispute.orders as {
    id: string;
    total_cents: number;
    requests: { title: string };
    provider_profiles: { business_name: string };
  };

  return (
    <PanelLink href={`/admin/disputes/${dispute.id}`} className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{order.requests.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-muted">{dispute.reason}</div>
        <div className="mt-1 font-mono text-[10.5px] text-faint">
          {order.provider_profiles.business_name} · {formatDateTime(dispute.created_at)}
        </div>
      </div>
      <Badge tone={dispute.status === "open" ? "danger" : "muted"}>
        {dispute.resolution ?? dispute.status}
      </Badge>
      <span className="font-mono text-[14px] font-semibold text-signal">
        {formatNzd(order.total_cents)}
      </span>
    </PanelLink>
  );
}
