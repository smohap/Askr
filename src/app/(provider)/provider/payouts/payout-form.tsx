"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { connectPayouts, type PayoutState } from "./actions";

export function PayoutForm({ label }: { label: string }) {
  const [state, action, pending] = useActionState(connectPayouts, {} as PayoutState);

  return (
    <form action={action} className="max-w-[360px]">
      <FormError>{state.error}</FormError>
      <Button type="submit" disabled={pending}>
        {pending ? "Opening Stripe…" : label}
      </Button>
    </form>
  );
}
