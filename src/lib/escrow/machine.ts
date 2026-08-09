/**
 * The escrow state machine.
 *
 * This module is pure: no database, no Stripe, no request context. It is the
 * single written-down answer to "is this move legal, and may this actor make
 * it" — `transition()` in ./transition.ts is the only caller that acts on it,
 * and the unit tests enumerate every state pair against it.
 *
 * Anything not in TRANSITIONS is illegal, including every move out of a
 * terminal state.
 */

export const ORDER_STATES = [
  "pending_payment",
  "escrow_held",
  "in_progress",
  "awaiting_confirmation",
  "released",
  "refunded",
  "disputed",
  "cancelled",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const ACTORS = ["buyer", "provider", "admin", "system", "stripe_webhook"] as const;

export type Actor = (typeof ACTORS)[number];

export type TransitionRule = {
  from: OrderState;
  to: OrderState;
  /** Who is allowed to make this specific move. */
  actors: readonly Actor[];
  /** The move is rejected without a non-empty reason. */
  requiresReason?: boolean;
  /** Why this edge exists, for the ledger and for anyone reading the table. */
  note: string;
};

export const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: "pending_payment",
    to: "escrow_held",
    actors: ["stripe_webhook"],
    note: "payment intent succeeded — the webhook is the only thing that may assert money moved",
  },
  {
    from: "pending_payment",
    to: "cancelled",
    actors: ["stripe_webhook", "system"],
    note: "payment failed or the intent expired",
  },
  {
    from: "escrow_held",
    to: "in_progress",
    actors: ["provider"],
    note: "provider marked the job started",
  },
  {
    from: "in_progress",
    to: "awaiting_confirmation",
    actors: ["provider"],
    note: "provider marked the job delivered",
  },
  {
    from: "awaiting_confirmation",
    to: "released",
    actors: ["buyer"],
    note: "buyer confirmed — capture fires, commission is split, provider is paid",
  },
  {
    from: "escrow_held",
    to: "disputed",
    actors: ["buyer", "provider"],
    requiresReason: true,
    note: "either party raised a dispute before work started",
  },
  {
    from: "in_progress",
    to: "disputed",
    actors: ["buyer", "provider"],
    requiresReason: true,
    note: "either party raised a dispute mid-job",
  },
  {
    from: "awaiting_confirmation",
    to: "disputed",
    actors: ["buyer", "provider"],
    requiresReason: true,
    note: "either party raised a dispute over delivery",
  },
  {
    from: "disputed",
    to: "released",
    actors: ["admin"],
    requiresReason: true,
    note: "admin resolved in the provider's favour",
  },
  {
    from: "disputed",
    to: "refunded",
    actors: ["admin"],
    requiresReason: true,
    note: "admin resolved in the buyer's favour",
  },
  {
    from: "escrow_held",
    to: "refunded",
    actors: ["buyer"],
    note: "buyer cancelled before work started",
  },
];

/** A state nothing can leave. Derived from the table, never listed separately. */
export function isTerminal(state: OrderState): boolean {
  return !TRANSITIONS.some((r) => r.from === state);
}

export function findRule(from: OrderState, to: OrderState): TransitionRule | undefined {
  return TRANSITIONS.find((r) => r.from === from && r.to === to);
}

export function isLegalTransition(from: OrderState, to: OrderState): boolean {
  return findRule(from, to) !== undefined;
}

/** The moves this actor could make from here — used to render the affordances. */
export function allowedTransitions(from: OrderState, actor: Actor): TransitionRule[] {
  return TRANSITIONS.filter((r) => r.from === from && r.actors.includes(actor));
}

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: "illegal_transition" | "actor_not_permitted" | "reason_required",
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

export type TransitionRequest = {
  from: OrderState;
  to: OrderState;
  actor: Actor;
  reason?: string | null;
};

/**
 * Throws unless the move is on the table, this actor may make it, and a reason
 * was supplied where one is required. Returns the matched rule so the caller
 * can record why the edge exists.
 */
export function assertTransition({ from, to, actor, reason }: TransitionRequest): TransitionRule {
  const rule = findRule(from, to);

  if (!rule) {
    throw new TransitionError(
      isTerminal(from)
        ? `${from} is terminal — no transition to ${to} is possible`
        : `${from} -> ${to} is not a legal transition`,
      "illegal_transition",
    );
  }

  if (!rule.actors.includes(actor)) {
    throw new TransitionError(
      `${actor} may not move an order from ${from} to ${to} (allowed: ${rule.actors.join(", ")})`,
      "actor_not_permitted",
    );
  }

  if (rule.requiresReason && !reason?.trim()) {
    throw new TransitionError(`${from} -> ${to} requires a reason`, "reason_required");
  }

  return rule;
}
