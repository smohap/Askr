import type { Metadata } from "next";
import { Countdown } from "@/components/countdown";
import { Badge } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime, formatDuration, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My offers" };

const TONE = {
  active: "signal",
  accepted: "signal",
  rejected: "danger",
  withdrawn: "muted",
  expired: "muted",
} as const;

export default async function ProviderOffersPage() {
  const provider = await requireProvider();
  const supabase = await createClient();

  const { data: offers } = await supabase
    .from("offers")
    .select(
      `id, price_cents, description, eta_minutes, warranty_months, expires_at, status, created_at,
       requests(id, title, location_label)`,
    )
    .eq("provider_id", provider.providerId)
    .order("created_at", { ascending: false });

  const live = offers?.filter((o) => o.status === "active") ?? [];
  const closed = offers?.filter((o) => o.status !== "active") ?? [];

  return (
    <div className="space-y-7 py-6">
      {!offers?.length && (
        <EmptyState
          title="No offers yet"
          hint="Open a request from your feed and send a price."
          action={{ href: "/provider/feed", label: "Browse requests" }}
        />
      )}

      <Group label="Live" offers={live} />
      <Group label="History" offers={closed} />
    </div>
  );
}

type Row = {
  id: string;
  price_cents: number;
  description: string;
  eta_minutes: number | null;
  warranty_months: number;
  expires_at: string;
  status: keyof typeof TONE;
  created_at: string;
  requests: unknown;
};

function Group({ label, offers }: { label: string; offers: Row[] }) {
  if (offers.length === 0) return null;

  return (
    <section>
      <SectionLabel className="mb-2.5">{label}</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {offers.map((o) => {
          const request = o.requests as { id: string; title: string; location_label: string } | null;

          return (
            <PanelLink key={o.id} href={request ? `/provider/feed/${request.id}` : "/provider/feed"}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="text-[13.5px] font-semibold">{request?.title ?? "Request"}</span>
                <span className="flex-none font-mono text-[16px] font-semibold text-signal">
                  {formatNzd(o.price_cents)}
                </span>
              </div>

              <p className="mb-3 line-clamp-2 text-[12.5px] text-muted">{o.description}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Badge tone={TONE[o.status]}>{o.status}</Badge>
                {o.eta_minutes !== null && (
                  <span className="font-mono text-[11px] text-muted">
                    ⏱ {formatDuration(o.eta_minutes)}
                  </span>
                )}
                {o.warranty_months > 0 && (
                  <span className="font-mono text-[11px] text-muted">🛡 {o.warranty_months}mo</span>
                )}
                {o.status === "active" ? (
                  <Countdown expiresAt={o.expires_at} />
                ) : (
                  <span className="font-mono text-[11px] text-faint">
                    {formatDateTime(o.created_at)}
                  </span>
                )}
              </div>
            </PanelLink>
          );
        })}
      </div>
    </section>
  );
}
