import { describe, expect, it } from "vitest";
import {
  ACTORS,
  ORDER_STATES,
  TRANSITIONS,
  TransitionError,
  allowedTransitions,
  assertTransition,
  isLegalTransition,
  isTerminal,
  type Actor,
  type OrderState,
} from "./machine";

/**
 * The eight legal moves from the brief, written out independently of the
 * implementation so the table can't drift without this failing.
 */
const LEGAL: ReadonlyArray<[OrderState, OrderState]> = [
  ["pending_payment", "escrow_held"],
  ["pending_payment", "cancelled"],
  ["escrow_held", "in_progress"],
  ["in_progress", "awaiting_confirmation"],
  ["awaiting_confirmation", "released"],
  ["escrow_held", "disputed"],
  ["in_progress", "disputed"],
  ["awaiting_confirmation", "disputed"],
  ["disputed", "released"],
  ["disputed", "refunded"],
  ["escrow_held", "refunded"],
];

const isLegalPair = (from: OrderState, to: OrderState) =>
  LEGAL.some(([f, t]) => f === from && t === to);

describe("the transition table", () => {
  it("permits exactly the documented moves and nothing else", () => {
    // all 64 ordered pairs, including every state to itself
    for (const from of ORDER_STATES) {
      for (const to of ORDER_STATES) {
        expect(
          isLegalTransition(from, to),
          `${from} -> ${to} should be ${isLegalPair(from, to) ? "legal" : "illegal"}`,
        ).toBe(isLegalPair(from, to));
      }
    }
  });

  it("has no duplicate edges", () => {
    const seen = TRANSITIONS.map((r) => `${r.from}->${r.to}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("treats released, refunded and cancelled as terminal", () => {
    expect(ORDER_STATES.filter(isTerminal).sort()).toEqual([
      "cancelled",
      "refunded",
      "released",
    ]);
  });

  it("rejects every move out of a terminal state", () => {
    for (const from of ORDER_STATES.filter(isTerminal)) {
      for (const to of ORDER_STATES) {
        for (const actor of ACTORS) {
          expect(() => assertTransition({ from, to, actor, reason: "x" })).toThrow(TransitionError);
        }
      }
    }
  });

  it("never allows a self-transition", () => {
    for (const state of ORDER_STATES) {
      expect(isLegalTransition(state, state)).toBe(false);
    }
  });
});

describe("actor entitlement", () => {
  const cases: ReadonlyArray<[OrderState, OrderState, Actor]> = [
    ["pending_payment", "escrow_held", "stripe_webhook"],
    ["pending_payment", "cancelled", "system"],
    ["escrow_held", "in_progress", "provider"],
    ["in_progress", "awaiting_confirmation", "provider"],
    ["awaiting_confirmation", "released", "buyer"],
    ["escrow_held", "disputed", "buyer"],
    ["in_progress", "disputed", "provider"],
    ["disputed", "released", "admin"],
    ["disputed", "refunded", "admin"],
    ["escrow_held", "refunded", "buyer"],
  ];

  it.each(cases)("allows %s -> %s by %s", (from, to, actor) => {
    expect(() => assertTransition({ from, to, actor, reason: "resolved" })).not.toThrow();
  });

  it("only the Stripe webhook may declare escrow held", () => {
    for (const actor of ACTORS.filter((a) => a !== "stripe_webhook")) {
      expect(() =>
        assertTransition({ from: "pending_payment", to: "escrow_held", actor }),
      ).toThrow(/may not move an order/);
    }
  });

  it("a provider cannot release its own payment", () => {
    expect(() =>
      assertTransition({ from: "awaiting_confirmation", to: "released", actor: "provider" }),
    ).toThrow(TransitionError);
  });

  it("a buyer cannot mark the job started or delivered", () => {
    expect(() => assertTransition({ from: "escrow_held", to: "in_progress", actor: "buyer" })).toThrow();
    expect(() =>
      assertTransition({ from: "in_progress", to: "awaiting_confirmation", actor: "buyer" }),
    ).toThrow();
  });

  it("only an admin resolves a dispute", () => {
    for (const actor of ACTORS.filter((a) => a !== "admin")) {
      for (const to of ["released", "refunded"] as const) {
        expect(() => assertTransition({ from: "disputed", to, actor, reason: "r" })).toThrow(
          /may not move an order/,
        );
      }
    }
  });

  it("a buyer cannot refund itself once work has started", () => {
    expect(() => assertTransition({ from: "in_progress", to: "refunded", actor: "buyer" })).toThrow(
      /not a legal transition/,
    );
  });
});

describe("reasons", () => {
  it("requires a reason to raise a dispute", () => {
    expect(() => assertTransition({ from: "escrow_held", to: "disputed", actor: "buyer" })).toThrow(
      /requires a reason/,
    );
    expect(() =>
      assertTransition({ from: "escrow_held", to: "disputed", actor: "buyer", reason: "   " }),
    ).toThrow(/requires a reason/);
    expect(() =>
      assertTransition({ from: "escrow_held", to: "disputed", actor: "buyer", reason: "no show" }),
    ).not.toThrow();
  });

  it("requires a reason to resolve a dispute", () => {
    for (const to of ["released", "refunded"] as const) {
      expect(() => assertTransition({ from: "disputed", to, actor: "admin" })).toThrow(
        /requires a reason/,
      );
    }
  });

  it("does not require a reason on the happy path", () => {
    expect(() =>
      assertTransition({ from: "awaiting_confirmation", to: "released", actor: "buyer" }),
    ).not.toThrow();
  });
});

describe("error codes", () => {
  it("distinguishes illegal moves, wrong actors and missing reasons", () => {
    const grab = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e as TransitionError;
      }
      throw new Error("expected a throw");
    };

    expect(grab(() => assertTransition({ from: "released", to: "refunded", actor: "admin" })).code).toBe(
      "illegal_transition",
    );
    expect(
      grab(() => assertTransition({ from: "escrow_held", to: "in_progress", actor: "buyer" })).code,
    ).toBe("actor_not_permitted");
    expect(
      grab(() => assertTransition({ from: "disputed", to: "refunded", actor: "admin" })).code,
    ).toBe("reason_required");
  });
});

describe("allowedTransitions", () => {
  it("gives the provider start and dispute from escrow_held", () => {
    expect(allowedTransitions("escrow_held", "provider").map((r) => r.to).sort()).toEqual([
      "disputed",
      "in_progress",
    ]);
  });

  it("gives the buyer confirm and dispute from awaiting_confirmation", () => {
    expect(allowedTransitions("awaiting_confirmation", "buyer").map((r) => r.to).sort()).toEqual([
      "disputed",
      "released",
    ]);
  });

  it("gives nobody anything from a terminal state", () => {
    for (const actor of ACTORS) {
      expect(allowedTransitions("released", actor)).toEqual([]);
      expect(allowedTransitions("refunded", actor)).toEqual([]);
    }
  });
});
