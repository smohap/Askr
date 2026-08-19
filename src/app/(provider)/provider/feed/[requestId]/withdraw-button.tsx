"use client";

import { useTransition } from "react";
import { withdrawOffer } from "@/app/(provider)/provider/offers/actions";

export function WithdrawButton({ offerId }: { offerId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void withdrawOffer(offerId))}
      className="w-full rounded-xl border border-danger px-4 py-3 text-[13.5px] font-semibold text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {pending ? "Withdrawing…" : "Withdraw offer"}
    </button>
  );
}
