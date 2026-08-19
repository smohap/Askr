"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, SignalNote } from "@/components/ui/form";
import { accept, reject, type DecisionState } from "./actions";

const empty: DecisionState = {};

/**
 * Accept and reject are separate forms rather than one form with two submit
 * values: accepting takes money and closes the request, so it should not be
 * one mis-click away from rejecting.
 */
export function OfferDecision({ offerId, requestId }: { offerId: string; requestId: string }) {
  const [acceptState, acceptAction, accepting] = useActionState(accept, empty);
  const [rejectState, rejectAction, rejecting] = useActionState(reject, empty);

  return (
    <div>
      <FormError>{acceptState.error ?? rejectState.error}</FormError>

      <SignalNote>
        🛡 Your payment is held in escrow and only released to the provider once you confirm the job
        is done.
      </SignalNote>

      <form action={acceptAction}>
        <input type="hidden" name="offerId" value={offerId} />
        <input type="hidden" name="requestId" value={requestId} />
        <Button type="submit" disabled={accepting || rejecting}>
          {accepting ? "Accepting…" : "Accept & pay →"}
        </Button>
      </form>

      <form action={rejectAction}>
        <input type="hidden" name="offerId" value={offerId} />
        <input type="hidden" name="requestId" value={requestId} />
        <Button type="submit" variant="danger" className="mt-2.5" disabled={accepting || rejecting}>
          {rejecting ? "Rejecting…" : "Reject this offer"}
        </Button>
      </form>
    </div>
  );
}
