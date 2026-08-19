"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import {
  cancelBeforeStart,
  confirmCompletion,
  raiseDispute,
  type EscrowState,
} from "@/lib/escrow/actions";
import type { OrderState } from "@/lib/escrow/machine";

const empty: EscrowState = {};

/**
 * The buyer's escrow affordances, and only the ones legal from where the order
 * is. The state machine rejects anything else anyway; this keeps the screen
 * from offering a button that is going to fail.
 */
export function OrderActions({ orderId, state }: { orderId: string; state: OrderState }) {
  const [confirmState, confirmAction, confirming] = useActionState(confirmCompletion, empty);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelBeforeStart, empty);
  const [disputeState, disputeAction, disputing] = useActionState(raiseDispute, empty);
  const [showDispute, setShowDispute] = useState(false);

  const busy = confirming || cancelling || disputing;
  const canDispute =
    state === "escrow_held" || state === "in_progress" || state === "awaiting_confirmation";

  return (
    <div className="mt-6">
      <FormError>{confirmState.error ?? cancelState.error ?? disputeState.error}</FormError>

      {state === "awaiting_confirmation" && (
        <form action={confirmAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" disabled={busy}>
            {confirming ? "Releasing payment…" : "Confirm completion & release payment →"}
          </Button>
        </form>
      )}

      {state === "escrow_held" && (
        <form action={cancelAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" variant="danger" disabled={busy}>
            {cancelling ? "Cancelling…" : "Cancel & refund"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-faint">
            Free while the job has not started.
          </p>
        </form>
      )}

      {canDispute && !showDispute && (
        <button
          type="button"
          onClick={() => setShowDispute(true)}
          className="mt-3 w-full text-center font-mono text-[11.5px] text-faint hover:text-danger"
        >
          Something went wrong — raise a dispute
        </button>
      )}

      {canDispute && showDispute && (
        <form action={disputeAction} className="mt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="as" value="buyer" />
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
