import type { Metadata } from "next";
import Link from "next/link";
import { Metric, Panel, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATES, type OrderState } from "@/lib/escrow/machine";

export const metadata: Metadata = { title: "Platform overview" };

/**
 * Phase 1 reporting: what is on the platform, what it is worth, and what needs
 * an admin. Counts come from head requests so no rows travel for a number.
 */
export default async function AdminOverview() {
  await requireRole("admin");
  const supabase = await createClient();

  const [
    buyers,
    providers,
    pendingVerification,
    liveRequests,
    openDisputes,
    orders,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "buyer"),
    supabase
      .from("provider_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "verified"),
    supabase
      .from("provider_profiles")
      .select("id", { count: "exact", head: true })
      .in("verification_status", ["pending", "unverified", "rejected"]),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("orders").select("state, total_cents, commission_cents"),
  ]);

  const rows = orders.data ?? [];
  const byState = new Map<OrderState, number>();
  for (const state of ORDER_STATES) byState.set(state, 0);
  for (const o of rows) byState.set(o.state as OrderState, (byState.get(o.state as OrderState) ?? 0) + 1);

  const released = rows.filter((o) => o.state === "released");
  const inEscrow = rows.filter((o) =>
    ["escrow_held", "in_progress", "awaiting_confirmation", "disputed"].includes(o.state),
  );

  // GMV is money that actually settled, not money that was ever quoted.
  const gmv = released.reduce((sum, o) => sum + o.total_cents, 0);
  const commission = released.reduce((sum, o) => sum + o.commission_cents, 0);
  const held = inEscrow.reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <div className="py-6">
      <h1 className="mb-5 font-display text-[20px] font-semibold">Platform overview</h1>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <Metric value={formatNzd(gmv)} label="Settled GMV" tone="signal" />
        </Panel>
        <Panel>
          <Metric value={formatNzd(commission)} label="Commission earned" tone="signal" />
        </Panel>
        <Panel>
          <Metric value={formatNzd(held)} label="Currently in escrow" tone="amber" />
        </Panel>
        <Panel>
          <Metric value={String(released.length)} label="Jobs completed" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <SectionLabel className="mb-3">Marketplace</SectionLabel>
          <Line label="Buyers" value={buyers.count ?? 0} />
          <Line label="Verified providers" value={providers.count ?? 0} />
          <Line label="Live requests" value={liveRequests.count ?? 0} />
        </Panel>

        <Panel>
          <SectionLabel className="mb-3">Orders by state</SectionLabel>
          {ORDER_STATES.filter((s) => (byState.get(s) ?? 0) > 0).map((s) => (
            <Line key={s} label={s.replace(/_/g, " ")} value={byState.get(s) ?? 0} />
          ))}
          {rows.length === 0 && <p className="text-[12.5px] text-faint">No orders yet.</p>}
        </Panel>

        <Panel>
          <SectionLabel className="mb-3">Needs an admin</SectionLabel>
          <Line label="Awaiting verification" value={pendingVerification.count ?? 0} />
          <Line label="Open disputes" value={openDisputes.count ?? 0} />
          <div className="mt-3.5 flex gap-3 font-mono text-[11.5px]">
            <Link href="/admin/verification" className="text-signal hover:underline">
              Verification →
            </Link>
            <Link href="/admin/disputes" className="text-signal hover:underline">
              Disputes →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px] text-muted">
      <span className="capitalize">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}
