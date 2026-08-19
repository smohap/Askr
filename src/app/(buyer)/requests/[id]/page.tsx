import { notFound, redirect } from "next/navigation";
import { Radar } from "@/components/radar";
import { OfferStack, type StackOffer } from "@/components/offers/offer-stack";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel, TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select(
      `id, title, description, detail, status, budget_cents, budget_mode, needed_by,
       location_label, radius_km, urgency, visibility, published_at,
       categories(name),
       request_broadcasts(count)`,
    )
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!request) notFound();

  // Once an offer is accepted the request has no decision left on it — the
  // order is where everything happens from then on.
  if (request.status !== "draft" && request.status !== "published") {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("request_id", id)
      .maybeSingle();

    if (order) redirect(`/orders/${order.id}`);
  }

  const { data: rawOffers } = await supabase
    .from("offers")
    .select(
      `id, price_cents, description, eta_minutes, warranty_months, expires_at, created_at,
       provider_profiles(id, business_name, rating_avg, rating_count)`,
    )
    .eq("request_id", id)
    .eq("status", "active");

  const { data: broadcasts } = await supabase
    .from("request_broadcasts")
    .select("provider_id, distance_km")
    .eq("request_id", id);

  const distances = new Map(broadcasts?.map((b) => [b.provider_id, b.distance_km]) ?? []);

  const offers: StackOffer[] = (rawOffers ?? []).map((o) => {
    const provider = o.provider_profiles as unknown as {
      id: string;
      business_name: string;
      rating_avg: number;
      rating_count: number;
    };

    return {
      id: o.id,
      priceCents: o.price_cents,
      createdAt: o.created_at,
      expiresAt: o.expires_at,
      description: o.description,
      etaMinutes: o.eta_minutes,
      warrantyMonths: o.warranty_months,
      distanceKm: distances.get(provider.id) ?? null,
      providerId: provider.id,
      providerName: provider.business_name,
      providerRating: Number(provider.rating_avg),
      providerRatingCount: provider.rating_count,
    };
  });

  const notified = request.request_broadcasts?.[0]?.count ?? 0;
  const category = (request.categories as unknown as { name: string } | null)?.name;

  // Mockup screen 03: the request is live but nobody has answered yet.
  if (request.status === "published" && offers.length === 0) {
    return (
      <>
        <TopBar title={request.title} backHref="/requests" />
        <div className="flex flex-col items-center px-8 py-14 text-center">
          <Radar />
          <h2 className="mt-6 font-display text-[19px] font-semibold">
            Broadcasting your request…
          </h2>
          <p className="mt-1.5 text-[13px] text-muted">
            Notifying verified providers within {request.radius_km}km of {request.location_label}
          </p>
          <p className="mt-3.5 font-mono text-[13px] text-signal">
            {notified} provider{notified === 1 ? "" : "s"} notified
          </p>
          {notified === 0 && (
            <p className="mt-6 max-w-[300px] text-[12px] text-faint">
              No verified providers cover this category and area yet. Your request stays live —
              widen the radius to reach more.
            </p>
          )}
        </div>
        <div className="px-5 pb-10">
          <RequestSummary request={request} category={category} />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title={offers.length > 0 ? `${offers.length} offer${offers.length === 1 ? "" : "s"} in` : request.title}
        backHref="/requests"
      />
      <div className="px-5 py-[18px]">
        <OfferStack requestId={request.id} offers={offers} />
        <div className="mt-7">
          <SectionLabel className="mb-2.5">Your request</SectionLabel>
          <RequestSummary request={request} category={category} />
        </div>
      </div>
    </>
  );
}

type SummaryRequest = {
  title: string;
  description: string;
  detail: Record<string, string | number>;
  status: string;
  budget_cents: number | null;
  budget_mode: "fixed" | "open";
  needed_by: string | null;
  location_label: string;
  urgency: string;
  visibility: string;
};

function RequestSummary({
  request,
  category,
}: {
  request: SummaryRequest;
  category?: string;
}) {
  const detail = Object.entries(request.detail ?? {});

  return (
    <Panel>
      <p className="mb-3 text-[13px] text-muted">{request.description}</p>

      <dl className="space-y-2 text-[12.5px]">
        <Row label="Budget">
          {request.budget_mode === "open" || request.budget_cents === null
            ? "Open to offers"
            : formatNzd(request.budget_cents)}
        </Row>
        {category && <Row label="Category">{category}</Row>}
        {request.needed_by && <Row label="Needed by">{formatDateTime(request.needed_by)}</Row>}
        <Row label="Location">{request.location_label}</Row>
        {detail.map(([key, value]) => (
          <Row key={key} label={key.replace(/_/g, " ")}>
            {String(value)}
          </Row>
        ))}
      </dl>

      <div className="mt-3.5 flex gap-1.5">
        {request.urgency === "urgent" && <Badge tone="amber">Urgent</Badge>}
        <Badge tone={request.visibility === "private" ? "muted" : "signal"}>
          {request.visibility}
        </Badge>
      </div>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">{label}</dt>
      <dd className="text-right text-muted">{children}</dd>
    </div>
  );
}
