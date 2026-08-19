import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transition } from "@/lib/escrow/transition";
import type { OrderState } from "@/lib/escrow/machine";

/**
 * Stripe is the only thing allowed to say that money moved.
 *
 * The client redirect after Checkout is a navigation, not a fact — the buyer
 * can close the tab, and a success_url can be visited by hand. So the order
 * leaves pending_payment here and nowhere else.
 *
 * Idempotency is the primary key on stripe_webhook_events: Stripe retries, and
 * a retry that gets past the insert would try an illegal transition out of a
 * state the first delivery already left.
 */

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
]);

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    // An unverifiable body is not from Stripe. Nothing is recorded.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad signature" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error: seenError } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  // 23505 — this event id is already recorded, so it has already been handled.
  if (seenError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (seenError) {
    // Could not record it, so do not act on it: let Stripe retry.
    return NextResponse.json({ error: seenError.message }, { status: 500 });
  }

  if (HANDLED.has(event.type)) {
    try {
      await handle(event);
    } catch (e) {
      // Drop the marker before returning 500. Stripe's retry carries the same
      // event id, and with the row still there the duplicate check above would
      // dismiss the retry as already handled when nothing had been.
      await admin.from("stripe_webhook_events").delete().eq("id", event.id);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "handler failed" },
        { status: 500 },
      );
    }
  }

  await admin
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return;

      const orderId = session.client_reference_id;
      if (!orderId) return;

      const intentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      await move(orderId, "escrow_held", {
        reason: "Payment received — funds held in escrow",
        payload: {
          checkout_session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
        },
        patch: intentId ? { stripe_payment_intent_id: intentId } : {},
      });
      return;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.client_reference_id) return;

      await move(session.client_reference_id, "cancelled", {
        reason: "Checkout expired before payment",
        payload: { checkout_session_id: session.id },
      });
      return;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.order_id;
      if (!orderId) return;

      await move(orderId, "cancelled", {
        reason: intent.last_payment_error?.message ?? "Payment failed",
        payload: { payment_intent_id: intent.id, code: intent.last_payment_error?.code },
      });
      return;
    }
  }
}

type MoveOptions = Omit<Parameters<typeof transition>[0], "orderId" | "to" | "actor" | "actorId">;

/**
 * Webhook moves are advisory about state: two Stripe events can describe the
 * same outcome, and an order that has already left pending_payment has nothing
 * left for this event to do. Anything else is a real failure and throws.
 */
async function move(orderId: string, to: OrderState, options: MoveOptions) {
  const admin = createAdminClient();

  const { data: order } = await admin.from("orders").select("state").eq("id", orderId).single();
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.state !== "pending_payment") return;

  await transition({ orderId, to, actor: "stripe_webhook", actorId: null, ...options });
}
