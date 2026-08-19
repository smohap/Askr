import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/identity";
import { EmptyState, Panel, PanelLink, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function ProviderDashboard() {
  const viewer = await requireRole("provider");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("provider_profiles")
    .select("id, business_name, rating_avg, rating_count, jobs_completed, verification_status")
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="py-8">
        <EmptyState
          title="Set up your business profile"
          hint="Add your business name, categories and service area to start receiving requests."
          action={{ href: "/provider/profile", label: "Create profile" }}
        />
      </div>
    );
  }

  const [newRequests, pendingOffers, wonJobs, revenue] = await Promise.all([
    supabase
      .from("request_broadcasts")
      .select("request_id", { count: "exact", head: true })
      .eq("provider_id", profile.id),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", profile.id),
    supabase
      .from("orders")
      .select("total_cents, commission_cents, state")
      .eq("provider_id", profile.id)
      .eq("state", "released"),
  ]);

  // Revenue is what actually reached the provider: total less the commission.
  const earned =
    revenue.data?.reduce((sum, o) => sum + (o.total_cents - o.commission_cents), 0) ?? 0;

  return (
    <div className="py-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[22px] font-semibold">{profile.business_name}</h1>
        {profile.verification_status !== "verified" && (
          <Link href="/provider/profile">
            <Badge tone={profile.verification_status === "rejected" ? "danger" : "amber"}>
              {profile.verification_status}
            </Badge>
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Requests seen" value={newRequests.count ?? 0} href="/provider/feed" />
        <Metric label="Live offers" value={pendingOffers.count ?? 0} href="/provider/offers" />
        <Metric label="Jobs won" value={wonJobs.count ?? 0} />
        <Metric label="Revenue" value={formatNzd(earned)} />
        <Metric
          label="Rating"
          value={profile.rating_count > 0 ? `★ ${Number(profile.rating_avg).toFixed(1)}` : "—"}
        />
      </div>

      <SectionLabel className="mb-2.5">Next</SectionLabel>
      <Panel>
        <p className="text-[13px] text-muted">
          {profile.verification_status === "verified"
            ? "You're verified. Matching requests land in your feed as buyers post them."
            : "Upload your verification documents to start receiving requests."}
        </p>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <>
      <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
        {label}
      </div>
      <div className="font-mono text-[22px] font-semibold text-signal">{value}</div>
    </>
  );

  return href ? <PanelLink href={href}>{body}</PanelLink> : <Panel>{body}</Panel>;
}
