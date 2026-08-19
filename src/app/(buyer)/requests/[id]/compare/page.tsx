import { notFound } from "next/navigation";
import Link from "next/link";
import { BestMatchTag } from "@/components/ui/identity";
import { EmptyState, TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { findBestMatch } from "@/lib/offers/best-match";
import { formatDistance, formatDuration, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/** Mockup screen 05 — every live offer on one grid, cheapest first. */
export default async function ComparePage({ params }: PageProps<"/requests/[id]/compare">) {
  const { id } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, title")
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!request) notFound();

  const { data: rawOffers } = await supabase
    .from("offers")
    .select(
      `id, price_cents, eta_minutes, warranty_months, created_at,
       provider_profiles(id, business_name, rating_avg, rating_count)`,
    )
    .eq("request_id", id)
    .eq("status", "active");

  const { data: broadcasts } = await supabase
    .from("request_broadcasts")
    .select("provider_id, distance_km")
    .eq("request_id", id);

  const distances = new Map(broadcasts?.map((b) => [b.provider_id, b.distance_km]) ?? []);

  const offers = (rawOffers ?? []).map((o) => {
    const p = o.provider_profiles as unknown as {
      id: string;
      business_name: string;
      rating_avg: number;
      rating_count: number;
    };
    return {
      id: o.id,
      priceCents: o.price_cents,
      createdAt: o.created_at,
      etaMinutes: o.eta_minutes,
      warrantyMonths: o.warranty_months,
      distanceKm: distances.get(p.id) === undefined ? null : Number(distances.get(p.id)),
      providerName: p.business_name,
      providerRating: Number(p.rating_avg),
      providerRatingCount: p.rating_count,
    };
  });

  const best = findBestMatch(offers);
  const sorted = [...offers].sort((a, b) => a.priceCents - b.priceCents);

  return (
    <>
      <TopBar title="Compare offers" backHref={`/requests/${id}`} />

      <div className="px-5 py-[18px]">
        {sorted.length === 0 ? (
          <EmptyState title="No live offers to compare" />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {["Provider", "Price", "Rating", "ETA", "Distance", "Warranty"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-grid px-1.5 py-2.5 text-left font-mono text-[9.5px] uppercase text-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="border-b border-grid px-1.5 py-2.5">
                      <Link href={`/requests/${id}/offers/${o.id}`} className="hover:text-signal">
                        {o.providerName}
                      </Link>
                      {o.id === best?.id && (
                        <div className="mt-1">
                          <BestMatchTag />
                        </div>
                      )}
                    </td>
                    <td className="border-b border-grid px-1.5 py-2.5 font-mono text-signal">
                      {formatNzd(o.priceCents)}
                    </td>
                    <td className="border-b border-grid px-1.5 py-2.5 font-mono">
                      {o.providerRatingCount > 0 ? o.providerRating.toFixed(1) : "—"}
                    </td>
                    <td className="border-b border-grid px-1.5 py-2.5 font-mono">
                      {o.etaMinutes === null ? "—" : formatDuration(o.etaMinutes)}
                    </td>
                    <td className="border-b border-grid px-1.5 py-2.5 font-mono">
                      {formatDistance(o.distanceKm)}
                    </td>
                    <td className="border-b border-grid px-1.5 py-2.5 font-mono">
                      {o.warrantyMonths > 0 ? `${o.warrantyMonths}mo` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
