import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignalNote } from "@/components/ui/form";
import { TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Confirm & pay" };

/**
 * Mockup screen 08. The amounts are read off the order rather than recomputed —
 * they were fixed when the offer was accepted, and a price that moved between
 * accepting and paying would be a different deal.
 */
export default async function PayPage({ params, searchParams }: PageProps<"/orders/[id]/pay">) {
  const { id } = await params;
  const { cancelled } = await searchParams;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, state, service_fee_cents, platform_fee_cents, total_cents,
       requests(title, needed_by),
       provider_profiles(business_name)`,
    )
    .eq("id", id)
    .eq("buyer_id", viewer.id)
    .single();

  if (!order) notFound();

  // Paying twice is not a thing that can happen: once the webhook has moved the
  // order there is nothing left to pay for.
  if (order.state !== "pending_payment") redirect(`/orders/${id}`);

  const request = order.requests as unknown as { title: string; needed_by: string | null };
  const provider = order.provider_profiles as unknown as { business_name: string };

  return (
    <>
      <TopBar title="Confirm & pay" backHref="/requests" />

      <div className="px-5 py-[18px]">
        <div className="mb-[18px] rounded-[14px] border border-grid bg-panel-raised p-[18px]">
          <Row label={provider.business_name} value={request.title} />
          {request.needed_by && (
            <Row label="Service date" value={formatDateTime(request.needed_by)} />
          )}
          <Row label="Service fee" value={formatNzd(order.service_fee_cents)} />
          <Row label="Platform fee" value={formatNzd(order.platform_fee_cents)} />

          <div className="mt-1.5 flex justify-between border-t border-grid pt-3 text-[15px] font-semibold">
            <span>Total</span>
            <span className="font-mono text-signal">{formatNzd(order.total_cents)}</span>
          </div>
        </div>

        <SignalNote>
          🛡 Your payment is held in escrow and only released to the provider once you confirm the
          job is done.
        </SignalNote>

        <PayForm orderId={order.id} cancelled={cancelled === "1"} />

        <p className="mt-3.5 text-center text-[11px] leading-relaxed text-faint">
          Card details are entered on Stripe, never here.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px] text-muted">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
