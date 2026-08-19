import { z } from "zod";

/** How long a provider may hold a price open. The countdown renders from this. */
export const EXPIRY_CHOICES = [
  { hours: 2, label: "2 hours" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

export const DEFAULT_EXPIRY_HOURS = 24;

export const offerInput = z.object({
  requestId: z.uuid(),
  priceCents: z
    .number()
    .int()
    .min(500, "Offers start at $5")
    .max(5_000_000, "That price looks like a typo"),
  description: z
    .string()
    .trim()
    .min(10, "Say what the buyer gets for this price")
    .max(2000),
  // Null means "not committing to a time" rather than "instant".
  etaMinutes: z.number().int().min(0).max(60 * 24 * 90).nullable(),
  warrantyMonths: z.number().int().min(0).max(120),
  terms: z.string().trim().max(2000).nullable(),
  expiresInHours: z.number().int().min(1).max(168),
});

export type OfferInput = z.infer<typeof offerInput>;

/** Minutes from the two-part form control, or null when left blank. */
export function parseEta(hours: FormDataEntryValue | null, minutes: FormDataEntryValue | null) {
  const h = typeof hours === "string" && hours !== "" ? Number(hours) : 0;
  const m = typeof minutes === "string" && minutes !== "" ? Number(minutes) : 0;
  if (h === 0 && m === 0) return null;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return Math.round(h * 60 + m);
}
