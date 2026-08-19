import type { Metadata } from "next";
import Link from "next/link";
import { Badge, LiveDot } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel, TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My requests" };

const STATUS_TONE = {
  draft: "muted",
  published: "signal",
  awarded: "amber",
  completed: "muted",
  cancelled: "danger",
} as const;

export default async function RequestsPage() {
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, title, status, budget_cents, budget_mode, needed_by, location_label, created_at, offers(count)",
    )
    .eq("buyer_id", viewer.id)
    .order("created_at", { ascending: false });

  const live = requests?.filter((r) => r.status === "published" || r.status === "awarded") ?? [];
  const drafts = requests?.filter((r) => r.status === "draft") ?? [];
  const done = requests?.filter((r) => r.status === "completed" || r.status === "cancelled") ?? [];

  return (
    <>
      <TopBar
        title="My requests"
        backHref="/"
        action={
          <Link href="/requests/new" className="font-mono text-[11.5px] text-signal hover:underline">
            + New
          </Link>
        }
      />

      <div className="space-y-7 px-5 py-[18px]">
        {!requests?.length && (
          <EmptyState
            title="No requests yet"
            hint="Post what you need and providers come to you."
          />
        )}

        <Group label="Live" requests={live} />
        <Group label="Drafts" requests={drafts} />
        <Group label="Closed" requests={done} />
      </div>
    </>
  );
}

type Row = {
  id: string;
  title: string;
  status: keyof typeof STATUS_TONE;
  budget_cents: number | null;
  budget_mode: "fixed" | "open";
  needed_by: string | null;
  location_label: string;
  offers: { count: number }[];
};

function Group({ label, requests }: { label: string; requests: Row[] }) {
  if (requests.length === 0) return null;

  return (
    <section>
      <SectionLabel className="mb-2.5">{label}</SectionLabel>
      <div className="space-y-2.5">
        {requests.map((r) => {
          const offerCount = r.offers?.[0]?.count ?? 0;
          return (
            <PanelLink key={r.id} href={`/requests/${r.id}`} className="p-3.5">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <span className="text-[13.5px] font-semibold">{r.title}</span>
                {r.status === "published" ? (
                  <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] text-signal">
                    <LiveDot />
                    {offerCount > 0 ? `${offerCount} offer${offerCount === 1 ? "" : "s"}` : "Broadcasting"}
                  </span>
                ) : (
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                )}
              </div>
              <div className="font-mono text-[11.5px] text-muted">
                {r.budget_mode === "open" || r.budget_cents === null
                  ? "Open budget"
                  : formatNzd(r.budget_cents)}
                {" · "}
                {r.location_label}
                {r.needed_by && ` · ${formatDateTime(r.needed_by)}`}
              </div>
            </PanelLink>
          );
        })}
      </div>
    </section>
  );
}
