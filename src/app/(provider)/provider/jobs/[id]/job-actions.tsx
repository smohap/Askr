"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import { markDelivered, raiseDispute, startJob, type EscrowState } from "@/lib/escrow/actions";
import type { OrderState } from "@/lib/escrow/machine";

const empty: EscrowState = {};

/** The provider moves the job forward twice; the buyer's confirmation ends it. */
export function JobActions({ orderId, state }: { orderId: string; state: OrderState }) {
  const [startState, startAction, starting] = useActionState(startJob, empty);
  const [deliverState, deliverAction, delivering] = useActionState(markDelivered, empty);
  const [disputeState, disputeAction, disputing] = useActionState(raiseDispute, empty);
  const [showDispute, setShowDispute] = useState(false);

  const busy = starting || delivering || disputing;
  const canDispute =
    state === "escrow_held" || state === "in_progress" || state === "awaiting_confirmation";

  return (
    <div className="mt-6 max-w-[420px]">
      <FormError>{startState.error ?? deliverState.error ?? disputeState.error}</FormError>

      {state === "escrow_held" && (
        <form action={startAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" disabled={busy}>
            {starting ? "Starting…" : "Start the job →"}
          </Button>
        </form>
      )}

      {state === "in_progress" && (
        <form action={deliverAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" disabled={busy}>
            {delivering ? "Submitting…" : "Mark delivered →"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-faint">
            The buyer confirms, and the payment is released to you.
          </p>
        </form>
      )}

      {canDispute && !showDispute && (
        <button
          type="button"
          onClick={() => setShowDispute(true)}
          className="mt-3 w-full text-center font-mono text-[11.5px] text-faint hover:text-danger"
        >
          Raise a dispute
        </button>
      )}

      {canDispute && showDispute && (
        <form action={disputeAction} className="mt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="as" value="provider" />
          <Textarea
            name="reason"
            rows={3}
            required
            minLength={10}
            placeholder="What happened? An admin reads this and decides whether the money is released or refunded."
          />
          <Button type="submit" variant="danger" className="mt-2.5" disabled={busy}>
            {disputing ? "Raising…" : "Raise dispute"}
          </Button>
        </form>
      )}
    </div>
  );
}
