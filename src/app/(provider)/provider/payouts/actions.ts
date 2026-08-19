"use server";

import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe/escrow";

export type PayoutState = { error?: string };

/**
 * Start or resume Stripe Connect onboarding.
 *
 * The account id is written with the service role: guard_provider_self_service()
 * strips stripe_account_id from any non-admin update, so a provider cannot point
 * their profile at someone else's payout account by editing their own row.
 */
export async function connectPayouts(
  _prev: PayoutState,
  _formData: FormData,
): Promise<PayoutState> {
  const provider = await requireProvider();
  const admin = createAdminClient();

  let url: string;
  try {
    const { data: profile } = await admin
      .from("provider_profiles")
      .select("stripe_account_id")
      .eq("id", provider.providerId)
      .single();

    let accountId = profile?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await createConnectAccount(provider.businessName, provider.email);
      accountId = account.id;
      await admin
        .from("provider_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", provider.providerId);
    }

    // Account links are single-use and short-lived, so this is created fresh
    // every time rather than stored.
    const link = await createOnboardingLink(accountId);
    url = link.url;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach Stripe" };
  }

  redirect(url);
}
