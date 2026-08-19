"use client";

import { useActionState } from "react";
import { StarPicker } from "@/components/reviews/star-picker";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import { submitReview, type ReviewState } from "@/lib/reviews/actions";

export function ReviewForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(submitReview, {} as ReviewState);

  return (
    <form action={action}>
      <FormError>{state.error}</FormError>
      <input type="hidden" name="orderId" value={orderId} />
      <StarPicker />
      <Textarea
        name="body"
        rows={3}
        placeholder="Great job, on time and tidy…"
        className="text-left"
      />
      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Posting…" : "Post review & finish"}
      </Button>
    </form>
  );
}
