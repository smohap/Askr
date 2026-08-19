import { notFound } from "next/navigation";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Avatar, Badge } from "@/components/ui/identity";
import { Panel, SectionLabel, TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDistance, formatDuration, formatNzd } from "@/lib/money";
import { quoteToAmounts } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { OfferDecision } from "./offer-decision";

export default async function OfferPage({ params }: PageProps<"/requests/[id]/offers/[offerId]">) {
  const { id, offerId } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, title, status")
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!request) notFound();

  const { data: offer } = await supabase
    .from("offers")
    .select(
      `id, price_cents, description, eta_minutes, warranty_months, terms, expires_at, status,
       provider_profiles(id, business_name, tagline, about, rating_avg, rating_count, jobs_completed, verification_status)`,
    )
    .eq("id", offerId)
    .eq("request_id", id)
    .single();

  if (!offer) notFound();

  const provider = offer.provider_profiles as unknown as {
    id: string;
    business_name: string;
    tagline: string | null;
    about: string | null;
    rating_avg: number;
    rating_count: number;
    jobs_completed: number;
    verification_status: string;
  };

  const { data: broadcast } = await supabase
    .from("request_broadcasts")
    .select("distance_km")
    .eq("request_id", id)
    .eq("provider_id", provider.id)
    .maybeSingle();

  const amounts = quoteToAmounts(offer.price_cents);
  const live = offer.status === "active" && Date.parse(offer.expires_at) > Date.now();

  return (
    <>
      <TopBar title={provider.business_name} backHref={`/requests/${id}`} />

      <div className="px-5 py-[18px]">
        <Panel className="mb-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={provider.business_name} size={44} />
              <div>
                <div className="text-[14px] font-semibold">{provider.business_name}</div>
                <div className="font-mono text-[11px] text-amber">
                  {provider.rating_count > 0
                    ? `★ ${Number(provider.rating_avg).toFixed(1)} · ${provider.jobs_completed} jobs`
                    : "New provider"}
                </div>
              </div>
            </div>
            <div className="font-mono text-[22px] font-semibold text-signal">
              {formatNzd(offer.price_cents)}
            </div>
          </div>

          {provider.verification_status === "verified" && (
            <div className="mb-3">
              <Badge tone="signal">Verified business</Badge>
            </div>
          )}

          <p className="mb-3 text-[13px] leading-relaxed text-muted">{offer.description}</p>

          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[11.5px] text-muted">
            {offer.eta_minutes !== null && <span>⏱ {formatDuration(offer.eta_minutes)} ETA</span>}
            <span>
              📍 {formatDistance(broadcast?.distance_km ? Number(broadcast.distance_km) : null)}
            </span>
            {offer.warranty_months > 0 && <span>🛡 {offer.warranty_months}mo warranty</span>}
            {offer.status === "active" && <Countdown expiresAt={offer.expires_at} />}
          </div>

          {offer.terms && (
            <>
              <SectionLabel className="mb-1.5 mt-4">Terms</SectionLabel>
              <p className="text-[12px] text-faint">{offer.terms}</p>
            </>
          )}
        </Panel>

        {live && request.status === "published" ? (
          <>
            <Panel className="mb-4">
              <SectionLabel className="mb-2.5">If you accept</SectionLabel>
              <dl className="space-y-1.5 text-[13px]">
                <Line label="Service fee">{formatNzd(amounts.serviceFeeCents)}</Line>
                <Line label="Platform fee">{formatNzd(amounts.platformFeeCents)}</Line>
                <div className="mt-1.5 flex justify-between border-t border-grid pt-3 text-[15px] font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-signal">{formatNzd(amounts.totalCents)}</span>
                </div>
              </dl>
            </Panel>

            <Link
              href={`/requests/${id}/chat/${provider.id}`}
              className="mb-2.5 block rounded-xl border border-grid px-4 py-[15px] text-center text-[14px] font-semibold text-muted transition-colors hover:border-signal-dim hover:text-text"
            >
              Message {provider.business_name}
            </Link>

            <OfferDecision offerId={offer.id} requestId={id} />
          </>
        ) : (
          <Panel>
            <p className="text-[13px] text-muted">
              {offer.status === "accepted"
                ? "You accepted this offer."
                : offer.status === "active"
                  ? "This offer has expired."
                  : `This offer is ${offer.status}.`}
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd className="font-mono">{children}</dd>
    </div>
  );
}
