"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import {
  decideDocument,
  decideProvider,
  type VerificationState,
} from "./actions";

const empty: VerificationState = {};

/**
 * Approve is one click; reject opens the reason box first. The asymmetry is the
 * point — a rejection the provider cannot act on is worse than no rejection.
 */
export function DecisionForm({
  target,
  id,
  approveLabel,
  rejectLabel,
}: {
  target: "document" | "provider";
  id: string;
  approveLabel: string;
  rejectLabel: string;
}) {
  const action = target === "document" ? decideDocument : decideProvider;
  const [state, submit, pending] = useActionState(action, empty);
  const [rejecting, setRejecting] = useState(false);

  const idField = target === "document" ? "documentId" : "providerId";

  return (
    <div className="mt-3">
      <FormError>{state.error}</FormError>

      {rejecting ? (
        <form action={submit}>
          <input type="hidden" name={idField} value={id} />
          <input type="hidden" name="decision" value="reject" />
          <Textarea
            name="reason"
            rows={2}
            required
            placeholder="What is missing or wrong? The provider sees this."
          />
          <div className="mt-2 flex gap-2">
            <Button type="submit" variant="danger" className="py-2.5 text-[13px]" disabled={pending}>
              {pending ? "Rejecting…" : "Confirm rejection"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="py-2.5 text-[13px]"
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <form action={submit} className="flex-1">
            <input type="hidden" name={idField} value={id} />
            <input type="hidden" name="decision" value="approve" />
            <Button type="submit" className="py-2.5 text-[13px]" disabled={pending}>
              {pending ? "Saving…" : approveLabel}
            </Button>
          </form>
          <Button
            type="button"
            variant="danger"
            className="flex-1 py-2.5 text-[13px]"
            onClick={() => setRejecting(true)}
          >
            {rejectLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
