"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/form";
import { replyToReview, type ReviewState } from "@/lib/reviews/actions";

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState(replyToReview, {} as ReviewState);

  return (
    <form action={action} className="mt-3">
      <FormError>{state.error}</FormError>
      <input type="hidden" name="reviewId" value={reviewId} />
      <Textarea name="reply" rows={2} required placeholder="Thanks — glad it went well…" />
      <Button type="submit" className="mt-2 py-2.5 text-[13px]" disabled={pending}>
        {pending ? "Posting…" : "Post reply"}
      </Button>
    </form>
  );
}
