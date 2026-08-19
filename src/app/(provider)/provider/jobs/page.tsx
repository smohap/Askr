import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { OrderState } from "@/lib/escrow/machine";

export const metadata: Metadata = { title: "Jobs" };

/** Live jobs first — a job waiting on this provider is the only urgent thing here. */
const NEEDS_ME: OrderState[] = ["escrow_held", "in_progress"];

export default async function ProviderJobsPage() {
  const provider = await requireProvider();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, state, total_cents, commission_cents, created_at,
       requests(title, location_label)`,
    )
    .eq("provider_id", provider.providerId)
    .order("created_at", { ascending: false });

  if (!orders?.length) {
    return (
      <div className="py-8">
        <EmptyState
          title="No jobs yet"
          hint="Jobs appear here once a buyer accepts one of your offers and pays into escrow."
          action={{ href: "/provider/feed", label: "Browse requests" }}
        />
      </div>
    );
  }

  const active = orders.filter((o) => NEEDS_ME.includes(o.state as OrderState));
  const rest = orders.filter((o) => !NEEDS_ME.includes(o.state as OrderState));

  return (
    <div className="py-6">
      <h1 className="mb-5 font-display text-[20px] font-semibold">Jobs</h1>

      {active.length > 0 && (
        <>
          <SectionLabel className="mb-2">Needs you</SectionLabel>
          <div className="mb-6 grid gap-2.5">
            {active.map((o) => (
              <JobRow key={o.id} order={o} />
            ))}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <SectionLabel className="mb-2">Everything else</SectionLabel>
          <div className="grid gap-2.5">
            {rest.map((o) => (
              <JobRow key={o.id} order={o} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type JobSummary = {
  id: string;
  state: string;
  total_cents: number;
  commission_cents: number;
  created_at: string;
  requests: unknown;
};

function JobRow({ order }: { order: JobSummary }) {
  const request = order.requests as { title: string; location_label: string };
  const state = order.state as OrderState;

  return (
    <PanelLink href={`/provider/jobs/${order.id}`} className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{request.title}</div>
        <div className="mt-0.5 font-mono text-[11px] text-faint">
          {request.location_label} · {formatDateTime(order.created_at)}
        </div>
      </div>
      <Badge tone={state === "disputed" ? "danger" : state === "released" ? "signal" : "muted"}>
        {state.replace(/_/g, " ")}
      </Badge>
      <span className="font-mono text-[14px] font-semibold text-signal">
        {formatNzd(order.total_cents - order.commission_cents)}
      </span>
    </PanelLink>
  );
}
