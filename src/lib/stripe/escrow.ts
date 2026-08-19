import "server-only";
import { getStripe, siteUrl } from "./server";
import { CURRENCY } from "@/lib/config";
import type { Order } from "@/lib/escrow/transition";

/**
 * Escrow is separate charges and transfers, not a delayed capture.
 *
 * The buyer's card is charged in full at accept time and the money sits in the
 * platform balance; on release the provider's share is transferred to their
 * connected account and the commission stays behind. A manual-capture
 * authorisation would have been simpler, but authorisations expire in seven
 * days and a scheduled job can sit in escrow for longer than that.
 *
 * Nothing here writes to the database. The webhook and the release/refund
 * actions record what happened by calling transition() with the Stripe ids.
 */

/**
 * The hosted payment page for an order.
 *
 * Hosted Checkout rather than an embedded card form: the card details never
 * touch this app, and there is one fewer client dependency to keep current.
 * `client_reference_id` is the order — the webhook needs it before the
 * PaymentIntent has been written back to the row.
 */
export async function createEscrowCheckout(
  order: Order,
  { requestTitle, providerName }: { requestTitle: string; providerName: string },
) {
  return getStripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: order.id,
      success_url: siteUrl(`/orders/${order.id}?paid=1`),
      cancel_url: siteUrl(`/orders/${order.id}/pay?cancelled=1`),
      // 30 minutes: long enough to find a card, short enough that an abandoned
      // order cancels itself rather than blocking the request forever.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: order.total_cents,
            product_data: {
              name: requestTitle,
              description: `${providerName} — held in escrow until you confirm the job is done`,
            },
          },
        },
      ],
      payment_intent_data: {
        // Read back on the order page and in support; the transfer is created
        // separately at release, so no on_behalf_of or transfer_data here.
        metadata: { order_id: order.id, provider_id: order.provider_id },
      },
      metadata: { order_id: order.id },
    },
    // A double-click on "Pay & confirm" reuses the session instead of opening
    // a second one against the same order.
    { idempotencyKey: `checkout_${order.id}` },
  );
}

/** The charge behind a paid order, needed to fund the transfer from it. */
async function chargeIdFor(order: Order): Promise<string> {
  if (!order.stripe_payment_intent_id) {
    throw new Error(`Order ${order.id} has no payment intent — nothing was ever charged`);
  }

  const intent = await getStripe().paymentIntents.retrieve(order.stripe_payment_intent_id);
  const charge = intent.latest_charge;

  if (!charge) throw new Error(`Payment intent ${intent.id} has no charge`);
  return typeof charge === "string" ? charge : charge.id;
}

/**
 * Pay the provider. `source_transaction` ties the transfer to the buyer's
 * charge, so it draws on those funds rather than requiring an available
 * platform balance.
 *
 * The idempotency key is the order, so a retry after a failed transition
 * returns the original transfer instead of paying twice.
 */
export async function releaseEscrow(
  order: Order,
  payoutCents: number,
  destinationAccountId: string,
): Promise<string> {
  const transfer = await getStripe().transfers.create(
    {
      amount: payoutCents,
      currency: order.currency,
      destination: destinationAccountId,
      source_transaction: await chargeIdFor(order),
      metadata: { order_id: order.id },
    },
    { idempotencyKey: `release_${order.id}` },
  );

  return transfer.id;
}

/** Return the whole payment, commission included — a refund keeps nothing. */
export async function refundEscrow(order: Order): Promise<string> {
  if (!order.stripe_payment_intent_id) {
    throw new Error(`Order ${order.id} has no payment intent — nothing to refund`);
  }

  const refund = await getStripe().refunds.create(
    {
      payment_intent: order.stripe_payment_intent_id,
      metadata: { order_id: order.id },
    },
    { idempotencyKey: `refund_${order.id}` },
  );

  return refund.id;
}

/**
 * Connect onboarding for a provider. Express accounts: Stripe hosts identity,
 * bank details and the payouts dashboard, so none of it lands in this schema.
 */
export async function createConnectAccount(businessName: string, email: string) {
  return getStripe().accounts.create({
    type: "express",
    country: "NZ",
    email,
    business_profile: { name: businessName },
    capabilities: {
      transfers: { requested: true },
    },
  });
}

export async function createOnboardingLink(accountId: string) {
  return getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: siteUrl("/provider/payouts?refresh=1"),
    return_url: siteUrl("/provider/payouts?done=1"),
  });
}

/** Whether Stripe will actually accept a transfer to this account yet. */
export async function payoutsEnabled(accountId: string): Promise<boolean> {
  const account = await getStripe().accounts.retrieve(accountId);
  return account.payouts_enabled === true && account.capabilities?.transfers === "active";
}
