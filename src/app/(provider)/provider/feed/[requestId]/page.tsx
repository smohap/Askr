import { notFound } from "next/navigation";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime, formatDuration, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { OfferForm } from "./offer-form";
import { WithdrawButton } from "./withdraw-button";

export default async function ProviderRequestPage({
  params,
}: PageProps<"/provider/feed/[requestId]">) {
  const { requestId } = await params;
  const provider = await requireProvider();
  const supabase = await createClient();

  // Readable only because a request_broadcasts row links this provider to it.
  const { data: request } = await supabase
    .from("requests")
    .select(
      `id, title, description, detail, status, budget_cents, budget_mode, needed_by,
       location_label, urgency, categories(name)`,
    )
    .eq("id", requestId)
    .single();

  if (!request) notFound();

  const { data: myOffer } = await supabase
    .from("offers")
    .select("id, price_cents, description, eta_minutes, warranty_months, expires_at, status")
    .eq("request_id", requestId)
    .eq("provider_id", provider.providerId)
    .in("status", ["active", "accepted"])
    .maybeSingle();

  const category = (request.categories as unknown as { name: string } | null)?.name;
  const detail = Object.entries((request.detail ?? {}) as Record<string, string | number>);

  return (
    <div className="grid gap-5 py-6 lg:grid-cols-[1fr_400px]">
      <div>
        <Link href="/provider/feed" className="font-mono text-[11.5px] text-faint hover:text-text">
          ← Back to feed
        </Link>

        <h1 className="mb-1.5 mt-3 font-display text-[22px] font-semibold">{request.title}</h1>

        <div className="mb-4 flex flex-wrap gap-2">
          {category && <Badge>{category}</Badge>}
          {request.urgency === "urgent" && <Badge tone="amber">Urgent</Badge>}
          <Badge tone={request.status === "published" ? "signal" : "muted"}>{request.status}</Badge>
        </div>

        <Panel className="mb-4">
          <p className="mb-4 text-[13.5px] leading-relaxed text-muted">{request.description}</p>

          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <Row label="Budget">
              {request.budget_mode === "open" || request.budget_cents === null
                ? "Open to offers"
                : formatNzd(request.budget_cents)}
            </Row>
            <Row label="Location">{request.location_label}</Row>
            {request.needed_by && <Row label="Needed by">{formatDateTime(request.needed_by)}</Row>}
            {detail.map(([key, value]) => (
              <Row key={key} label={key.replace(/_/g, " ")}>
                {String(value)}
              </Row>
            ))}
          </dl>
        </Panel>
      </div>

      <div>
        {myOffer ? (
          <Panel>
            <SectionLabel className="mb-3">Your offer</SectionLabel>
            <div className="mb-2 font-mono text-[24px] font-semibold text-signal">
              {formatNzd(myOffer.price_cents)}
            </div>
            <p className="mb-3 text-[12.5px] text-muted">{myOffer.description}</p>

            <div className="mb-4 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[11.5px] text-muted">
              {myOffer.eta_minutes !== null && <span>⏱ {formatDuration(myOffer.eta_minutes)}</span>}
              {myOffer.warranty_months > 0 && <span>🛡 {myOffer.warranty_months}mo</span>}
              {myOffer.status === "active" && <Countdown expiresAt={myOffer.expires_at} />}
            </div>

            {myOffer.status === "accepted" ? (
              <Badge tone="signal">Accepted — check your jobs</Badge>
            ) : (
              <>
                <WithdrawButton offerId={myOffer.id} />
                <p className="mt-2.5 text-[11.5px] text-faint">
                  Withdrawing frees you to send a revised price. There are no counter-offers — if
                  the buyer wants a different number, agree it in chat and re-offer.
                </p>
              </>
            )}
          </Panel>
        ) : request.status === "published" ? (
          <OfferForm requestId={request.id} budgetCents={request.budget_cents} />
        ) : (
          <Panel>
            <p className="text-[13px] text-muted">
              This request is {request.status}. It is no longer taking offers.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
        {label}
      </dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}
