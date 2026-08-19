"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { Avatar, BestMatchTag, LiveDot } from "@/components/ui/identity";
import { EmptyState, Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";
import { findBestMatch, sortOffers, type SortKey } from "@/lib/offers/best-match";
import { formatDistance, formatDuration, formatNzd } from "@/lib/money";

export type StackOffer = {
  id: string;
  priceCents: number;
  createdAt: string;
  expiresAt: string;
  description: string;
  etaMinutes: number | null;
  warrantyMonths: number;
  distanceKm: number | null;
  providerId: string;
  providerName: string;
  providerRating: number;
  providerRatingCount: number;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "rating", label: "Rating" },
  { key: "eta", label: "ETA" },
  { key: "distance", label: "Distance" },
];

export function OfferStack({
  requestId,
  offers,
}: {
  requestId: string;
  offers: StackOffer[];
}) {
  const [sort, setSort] = useState<SortKey>("price");
  const router = useRouter();

  // New offers land without a refresh — this is the "compete within minutes"
  // promise, so the buyer has to see it happen.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`offers:${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "askr", table: "offers", filter: `request_id=eq.${requestId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requestId, router]);

  const best = useMemo(() => findBestMatch(offers), [offers]);
  const sorted = useMemo(() => sortOffers(offers, sort), [offers, sort]);

  if (offers.length === 0) {
    return (
      <EmptyState
        title="No offers yet"
        hint="Matched providers have been notified. Offers usually arrive within minutes."
      />
    );
  }

  return (
    <div>
      <div className="scrollbar-none -mx-5 mb-3.5 flex gap-1.5 overflow-x-auto px-5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={
              "flex-none rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors " +
              (sort === s.key
                ? "border-signal text-signal"
                : "border-grid text-muted hover:border-signal-dim")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((offer, i) => (
          <Link key={offer.id} href={`/requests/${requestId}/offers/${offer.id}`} className="block">
            <Panel
              className={
                "animate-land transition-colors hover:border-signal-dim " +
                (offer.id === best?.id ? "border-signal shadow-[0_0_0_1px_var(--signal-dim)]" : "")
              }
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {offer.id === best?.id && (
                <div className="mb-1.5">
                  <BestMatchTag />
                </div>
              )}

              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={offer.providerName} />
                  <div>
                    <div className="text-[13.5px] font-semibold">{offer.providerName}</div>
                    <div className="font-mono text-[11px] text-amber">
                      {offer.providerRatingCount > 0
                        ? `★ ${offer.providerRating.toFixed(1)} · ${offer.providerRatingCount} jobs`
                        : "New provider"}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-[18px] font-semibold text-signal">
                  {formatNzd(offer.priceCents)}
                </div>
              </div>

              <p className="mb-2 line-clamp-2 text-[12.5px] text-muted">{offer.description}</p>

              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11.5px] text-muted">
                {offer.etaMinutes !== null && <span>⏱ {formatDuration(offer.etaMinutes)} ETA</span>}
                <span>📍 {formatDistance(offer.distanceKm)}</span>
                {offer.warrantyMonths > 0 && <span>🛡 {offer.warrantyMonths}mo warranty</span>}
                <Countdown expiresAt={offer.expiresAt} />
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      {offers.length > 1 && (
        <Link
          href={`/requests/${requestId}/compare`}
          className="mt-3.5 block rounded-xl border border-grid px-4 py-[15px] text-center text-[14.5px] font-bold text-muted transition-colors hover:border-signal-dim hover:text-text"
        >
          Compare side by side
        </Link>
      )}
    </div>
  );
}

/** The live header count while a request is out to providers. */
export function OfferCount({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-signal">
      <LiveDot />
      {count === 0 ? "Broadcasting" : `${count} offer${count === 1 ? "" : "s"} in`}
    </span>
  );
}
