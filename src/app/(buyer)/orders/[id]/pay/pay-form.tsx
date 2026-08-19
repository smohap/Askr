"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { startCheckout, type EscrowState } from "@/lib/escrow/actions";

export function PayForm({ orderId, cancelled }: { orderId: string; cancelled: boolean }) {
  const [state, action, pending] = useActionState(startCheckout, {} as EscrowState);

  return (
    <form action={action}>
      <FormError>
        {state.error ?? (cancelled ? "Payment cancelled — the offer is still held for you." : null)}
      </FormError>
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Opening Stripe…" : "Pay & confirm →"}
      </Button>
    </form>
  );
}
