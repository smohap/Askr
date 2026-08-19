import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTransition, TransitionError, type Actor, type OrderState } from "./machine";

/**
 * The single entry point for moving an order.
 *
 * No route handler, server action or webhook mutates orders.state directly —
 * they all come through here. This function validates the move against the
 * table in ./machine.ts and the actor's right to make it, then hands off to
 * askr.apply_order_transition(), which re-checks the from-state under a row
 * lock and writes the state change and its order_events row in one transaction.
 *
 * Two layers on purpose: the rules are pure and exhaustively unit-tested here,
 * while atomicity and the race are the database's problem.
 */

export type Order = {
  id: string;
  request_id: string;
  offer_id: string;
  buyer_id: string;
  provider_id: string;
  state: OrderState;
  service_fee_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  commission_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_account_id: string | null;
};

export type TransitionOptions = {
  orderId: string;
  to: OrderState;
  actor: Actor;
  /** profiles.id of the human responsible, or null for system/webhook moves. */
  actorId?: string | null;
  reason?: string | null;
  /** Anything worth keeping in the ledger — Stripe ids, amounts, error codes. */
  payload?: Record<string, unknown>;
  /** Columns to set alongside the state change, e.g. stripe_transfer_id. */
  patch?: Partial<
    Pick<Order, "stripe_payment_intent_id" | "stripe_transfer_id" | "stripe_account_id">
  >;
};

export async function transition({
  orderId,
  to,
  actor,
  actorId = null,
  reason = null,
  payload = {},
  patch = {},
}: TransitionOptions): Promise<Order> {
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("orders")
    .select("state")
    .eq("id", orderId)
    .single();

  if (readError || !current) {
    throw new TransitionError(`Order ${orderId} not found`, "illegal_transition");
  }

  // Throws before anything is written if the move is not on the table, this
  // actor may not make it, or a required reason is missing.
  assertTransition({ from: current.state as OrderState, to, actor, reason });

  const { data, error } = await admin.rpc("apply_order_transition", {
    p_order_id: orderId,
    p_from_state: current.state,
    p_to_state: to,
    p_actor: actor,
    p_actor_id: actorId,
    p_reason: reason,
    p_payload: payload,
    p_patch: patch,
  });

  if (error) {
    // The function raises when the from-state moved underneath us — someone
    // else transitioned this order between our read and our write.
    throw new TransitionError(error.message, "illegal_transition");
  }

  return data as unknown as Order;
}

/** Current state plus its ledger, for the buyer's status timeline. */
export async function getOrderWithEvents(orderId: string) {
  const admin = createAdminClient();

  const [{ data: order }, { data: events }] = await Promise.all([
    admin.from("orders").select("*").eq("id", orderId).single(),
    admin
      .from("order_events")
      .select("id, from_state, to_state, actor, reason, created_at")
      .eq("order_id", orderId)
      .order("id"),
  ]);

  return { order: order as Order | null, events: events ?? [] };
}
