"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import { resolveDispute, type ResolveState } from "../actions";

type Resolution = "released" | "refunded";

/**
 * The reason is written once and applies to whichever way this goes, so the
 * admin cannot pick an outcome and then justify it with a different sentence
 * than the one they had in mind.
 */
export function ResolveForm({
  disputeId,
  orderId,
  providerName,
  buyerName,
}: {
  disputeId: string;
  orderId: string;
  providerName: string;
  buyerName: string;
}) {
  const [state, action, pending] = useActionState(resolveDispute, {} as ResolveState);
  const [resolution, setResolution] = useState<Resolution>("released");

  return (
    <form action={action} className="max-w-[520px]">
      <FormError>{state.error}</FormError>
      <input type="hidden" name="disputeId" value={disputeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="resolution" value={resolution} />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Choice
          selected={resolution === "released"}
          onClick={() => setResolution("released")}
          title="Release"
          sub={`Pay ${providerName}`}
        />
        <Choice
          selected={resolution === "refunded"}
          onClick={() => setResolution("refunded")}
          title="Refund"
          sub={`Return the money to ${buyerName}`}
        />
      </div>

      <Textarea
        name="reason"
        rows={3}
        required
        minLength={10}
        placeholder="Why this outcome? Both parties see this."
      />

      <Button type="submit" className="mt-3" disabled={pending}>
        {pending
          ? "Resolving…"
          : resolution === "released"
            ? "Release payment to the provider"
            : "Refund the buyer in full"}
      </Button>
    </form>
  );
}

function Choice({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "rounded-[10px] border px-3.5 py-3 text-left transition-colors " +
        (selected ? "border-signal bg-signal-wash-soft" : "border-grid hover:border-signal-dim")
      }
    >
      <div className="text-[13.5px] font-semibold">{title}</div>
      <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>
    </button>
  );
}
