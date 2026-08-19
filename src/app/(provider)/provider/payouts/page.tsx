import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutsEnabled } from "@/lib/stripe/escrow";
import { PayoutForm } from "./payout-form";

export const metadata: Metadata = { title: "Payouts" };

/**
 * Connect onboarding. Nothing about bank accounts or identity documents is
 * stored here — Stripe holds all of it, and this page only ever knows whether
 * the account can receive a transfer yet.
 */
export default async function PayoutsPage() {
  const provider = await requireProvider();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("provider_profiles")
    .select("stripe_account_id")
    .eq("id", provider.providerId)
    .single();

  const accountId = profile?.stripe_account_id ?? null;
  const ready = accountId ? await payoutsEnabled(accountId) : false;

  return (
    <div className="py-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[20px] font-semibold">Payouts</h1>
        <Badge tone={ready ? "signal" : accountId ? "amber" : "muted"}>
          {ready ? "ready" : accountId ? "incomplete" : "not set up"}
        </Badge>
      </div>

      <Panel className="max-w-[560px]">
        <SectionLabel className="mb-2.5">Stripe Connect</SectionLabel>
        <p className="text-[13px] leading-relaxed text-muted">
          Buyers pay into escrow on Servuber. When a buyer confirms the job, your share is
          transferred to your Stripe account — the platform keeps only its commission.
        </p>

        {!ready && (
          <p className="mt-3 text-[12.5px] text-amber">
            Until this is finished, a buyer cannot release payment on a job you complete.
          </p>
        )}

        <div className="mt-4">
          {ready ? (
            <PayoutForm label="Update payout details" />
          ) : (
            <PayoutForm label={accountId ? "Finish setup on Stripe →" : "Set up payouts →"} />
          )}
        </div>
      </Panel>
    </div>
  );
}
