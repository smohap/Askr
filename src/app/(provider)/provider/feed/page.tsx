import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime, formatDistance, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Request feed" };

/**
 * Every request broadcast to this provider. The rows exist because the matcher
 * put them there — RLS uses the same table to grant the read.
 */
export default async function FeedPage() {
  const provider = await requireProvider();
  const supabase = await createClient();

  const { data: broadcasts } = await supabase
    .from("request_broadcasts")
    .select(
      `request_id, distance_km, notified_at,
       requests(id, title, description, status, budget_cents, budget_mode, needed_by,
                location_label, urgency, categories(name))`,
    )
    .eq("provider_id", provider.providerId)
    .order("notified_at", { ascending: false })
    .limit(50);

  const { data: myOffers } = await supabase
    .from("offers")
    .select("request_id, status")
    .eq("provider_id", provider.providerId)
    .in("status", ["active", "accepted"]);

  const answered = new Map(myOffers?.map((o) => [o.request_id, o.status]) ?? []);

  const open =
    broadcasts?.filter((b) => {
      const r = b.requests as unknown as { status: string } | null;
      return r?.status === "published";
    }) ?? [];

  if (provider.verificationStatus !== "verified") {
    return (
      <div className="py-8">
        <EmptyState
          title="Verification pending"
          hint="Once an admin approves your documents, matching requests appear here and you can send offers."
        />
      </div>
    );
  }

  return (
    <div className="py-6">
      <SectionLabel className="mb-3">
        {open.length} open request{open.length === 1 ? "" : "s"} in your area
      </SectionLabel>

      {open.length === 0 ? (
        <EmptyState
          title="Nothing right now"
          hint="Requests matching your categories and service area land here the moment they are posted."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {open.map((b) => {
            const r = b.requests as unknown as {
              id: string;
              title: string;
              description: string;
              budget_cents: number | null;
              budget_mode: "fixed" | "open";
              needed_by: string | null;
              location_label: string;
              urgency: string;
              categories: { name: string } | null;
            };
            const state = answered.get(r.id);

            return (
              <PanelLink key={r.id} href={`/provider/feed/${r.id}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span className="text-[14px] font-semibold">{r.title}</span>
                  <span className="flex-none font-mono text-[16px] text-signal">
                    {r.budget_mode === "open" || r.budget_cents === null
                      ? "Open"
                      : formatNzd(r.budget_cents)}
                  </span>
                </div>

                <p className="mb-3 line-clamp-2 text-[12.5px] text-muted">{r.description}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {r.categories && <Badge>{r.categories.name}</Badge>}
                  {r.urgency === "urgent" && <Badge tone="amber">Urgent</Badge>}
                  {state === "active" && <Badge tone="signal">Offer sent</Badge>}
                  {state === "accepted" && <Badge tone="signal">Won</Badge>}
                </div>

                <div className="mt-3 font-mono text-[11px] text-faint">
                  {formatDistance(b.distance_km === null ? null : Number(b.distance_km))} ·{" "}
                  {r.location_label}
                  {r.needed_by && ` · ${formatDateTime(r.needed_by)}`}
                </div>
              </PanelLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
