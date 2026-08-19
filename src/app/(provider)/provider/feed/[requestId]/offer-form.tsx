"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Panel } from "@/components/ui/panel";
import { DEFAULT_EXPIRY_HOURS, EXPIRY_CHOICES } from "@/lib/validation/offer";
import { submitOffer, type OfferFormState } from "@/app/(provider)/provider/offers/actions";

const empty: OfferFormState = {};

export function OfferForm({
  requestId,
  budgetCents,
}: {
  requestId: string;
  budgetCents: number | null;
}) {
  const [state, action, pending] = useActionState(submitOffer, empty);
  const [price, setPrice] = useState(budgetCents ? String(budgetCents / 100) : "");

  return (
    <Panel>
      <h2 className="mb-4 font-display text-[16px] font-semibold">Send an offer</h2>

      <form action={action}>
        <FormError>{state.error}</FormError>
        <input type="hidden" name="requestId" value={requestId} />

        <Field
          label="Your price (NZD)"
          htmlFor="priceDollars"
          hint={
            budgetCents
              ? "Pre-filled with the buyer's budget. Undercut it or justify going over."
              : "The buyer left the budget open."
          }
        >
          <Input
            id="priceDollars"
            name="priceDollars"
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="170"
            className="font-mono text-[16px] text-signal"
          />
        </Field>

        <Field label="What the buyer gets" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            required
            placeholder="Full clean of a 4-bedroom home, eco products, two-person team, roughly 3 hours."
          />
        </Field>

        <Field label="ETA" hint="How soon you can start. Leave blank if you'd rather not commit.">
          <div className="flex gap-2">
            <Input
              name="etaHours"
              type="number"
              min={0}
              max={2160}
              placeholder="0"
              aria-label="ETA hours"
              className="font-mono"
            />
            <Input
              name="etaMinutes"
              type="number"
              min={0}
              max={59}
              placeholder="45"
              aria-label="ETA minutes"
              className="font-mono"
            />
          </div>
        </Field>

        <Field label="Warranty (months)" htmlFor="warrantyMonths">
          <Input
            id="warrantyMonths"
            name="warrantyMonths"
            type="number"
            min={0}
            max={120}
            defaultValue={0}
            className="font-mono"
          />
        </Field>

        <Field label="Offer expires in" htmlFor="expiresInHours">
          <Select id="expiresInHours" name="expiresInHours" defaultValue={DEFAULT_EXPIRY_HOURS}>
            {EXPIRY_CHOICES.map((c) => (
              <option key={c.hours} value={c.hours}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Terms" htmlFor="terms" hint="Optional. Cancellation, access needs, exclusions.">
          <Textarea id="terms" name="terms" rows={2} />
        </Field>

        <Field label="Attachments" htmlFor="attachments" hint="Quotes, certificates, past work.">
          <Input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept="image/*,application/pdf"
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send offer →"}
        </Button>
      </form>
    </Panel>
  );
}
