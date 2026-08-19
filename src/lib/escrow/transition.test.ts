import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransitionError } from "./machine";

/**
 * transition() with the database replaced by a stub.
 *
 * machine.test.ts already proves the table. What is left to prove here is the
 * wiring: that transition() reads the current state, refuses the move before
 * writing anything, passes the from-state it validated against down to
 * apply_order_transition, and turns a lost race into a TransitionError rather
 * than a raw Postgres message.
 */

const rpc = vi.fn();
let currentState = "escrow_held";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { state: currentState }, error: null }),
        }),
      }),
    }),
    rpc,
  }),
}));

const { transition } = await import("./transition");

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { id: "order-1", state: "in_progress" }, error: null });
  currentState = "escrow_held";
});

describe("transition()", () => {
  it("calls apply_order_transition with the state it validated against", async () => {
    await transition({
      orderId: "order-1",
      to: "in_progress",
      actor: "provider",
      actorId: "provider-user",
      reason: "started",
    });

    expect(rpc).toHaveBeenCalledOnce();
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("apply_order_transition");
    expect(args).toMatchObject({
      p_order_id: "order-1",
      p_from_state: "escrow_held",
      p_to_state: "in_progress",
      p_actor: "provider",
      p_actor_id: "provider-user",
    });
  });

  it("writes nothing when the move is not on the table", async () => {
    currentState = "escrow_held";

    await expect(
      transition({ orderId: "order-1", to: "released", actor: "buyer" }),
    ).rejects.toMatchObject({ code: "illegal_transition" });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes nothing when the actor may not make that move", async () => {
    await expect(
      transition({ orderId: "order-1", to: "in_progress", actor: "buyer" }),
    ).rejects.toMatchObject({ code: "actor_not_permitted" });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes nothing when a required reason is missing", async () => {
    await expect(
      transition({ orderId: "order-1", to: "disputed", actor: "buyer" }),
    ).rejects.toMatchObject({ code: "reason_required" });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses to leave a terminal state", async () => {
    currentState = "released";

    await expect(
      transition({ orderId: "order-1", to: "refunded", actor: "admin", reason: "changed my mind" }),
    ).rejects.toThrow(TransitionError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns a lost race into a TransitionError", async () => {
    // apply_order_transition raises when the row moved between our read and
    // our write — two admins resolving the same dispute, say.
    rpc.mockResolvedValue({
      data: null,
      error: { message: "order X is disputed, expected escrow_held — transition rejected" },
    });

    await expect(
      transition({ orderId: "order-1", to: "in_progress", actor: "provider" }),
    ).rejects.toThrow(TransitionError);
  });
});
