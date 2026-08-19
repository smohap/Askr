import { z } from "zod";

/**
 * One request schema throughout. The category changes which optional fields
 * render into `detail`; it never changes the flow.
 */

export type DetailField = {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  options?: readonly string[];
  placeholder?: string;
  required?: boolean;
};

/** Keyed by category slug. A category with no entry simply renders no extras. */
export const CATEGORY_FIELDS: Record<string, readonly DetailField[]> = {
  "home-services": [
    {
      name: "property_type",
      label: "Property type",
      type: "select",
      options: ["House", "Apartment", "Townhouse", "Commercial"],
    },
    { name: "bedrooms", label: "Bedrooms", type: "number", placeholder: "4" },
    {
      name: "access",
      label: "Access",
      type: "select",
      options: ["I'll be there", "Key left out", "Building concierge"],
    },
  ],
  automotive: [
    { name: "make", label: "Make", type: "text", placeholder: "Toyota", required: true },
    { name: "model", label: "Model", type: "text", placeholder: "Corolla", required: true },
    { name: "year", label: "Year", type: "number", placeholder: "2018" },
    { name: "rego", label: "Rego", type: "text", placeholder: "ABC123" },
  ],
  electronics: [
    { name: "brand", label: "Brand", type: "text", placeholder: "Apple" },
    { name: "model", label: "Model", type: "text", placeholder: "MacBook Air M4" },
    {
      name: "condition",
      label: "Condition wanted",
      type: "select",
      options: ["New", "Refurbished", "Used — any"],
    },
  ],
  education: [
    { name: "subject", label: "Subject", type: "text", placeholder: "NCEA Level 2 Maths", required: true },
    {
      name: "level",
      label: "Level",
      type: "select",
      options: ["Primary", "Intermediate", "Secondary", "Tertiary", "Adult"],
    },
    { name: "mode", label: "Mode", type: "select", options: ["In person", "Online", "Either"] },
  ],
  events: [
    { name: "guest_count", label: "Guests", type: "number", placeholder: "80", required: true },
    { name: "venue", label: "Venue", type: "text", placeholder: "Ponsonby Central" },
    {
      name: "event_type",
      label: "Event type",
      type: "select",
      options: ["Wedding", "Birthday", "Corporate", "Community", "Other"],
    },
  ],
  other: [],
};

export const BUDGET_MODES = ["fixed", "open"] as const;
export const URGENCIES = ["standard", "urgent"] as const;
export const VISIBILITIES = ["public", "private"] as const;

/** $5 to $50,000 — wide enough for Phase 1 categories, narrow enough to catch a typo. */
const MIN_BUDGET_CENTS = 500;
const MAX_BUDGET_CENTS = 5_000_000;

export const requestInput = z
  .object({
    title: z.string().trim().min(6, "Give the request a short title").max(120),
    description: z.string().trim().min(20, "Describe what you need in a sentence or two").max(4000),
    categorySlug: z.string().min(1, "Pick a category"),
    detail: z.record(z.string(), z.union([z.string(), z.number()])).default({}),

    budgetMode: z.enum(BUDGET_MODES),
    budgetCents: z.number().int().min(MIN_BUDGET_CENTS).max(MAX_BUDGET_CENTS).nullable(),

    neededBy: z.iso.datetime({ offset: true }).nullable(),

    locationLabel: z.string().trim().min(2, "Where is this happening?"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radiusKm: z.number().int().min(1).max(200),

    urgency: z.enum(URGENCIES),
    visibility: z.enum(VISIBILITIES),
  })
  // A fixed budget without an amount is the one combination that cannot be
  // stored — the database has the same check.
  .refine((v) => v.budgetMode === "open" || v.budgetCents !== null, {
    message: "Set an amount, or switch to an open budget",
    path: ["budgetCents"],
  });

export type RequestInput = z.infer<typeof requestInput>;

/**
 * Category-specific required fields. Kept separate from the base schema so the
 * shape of a request never depends on its category.
 */
export function validateDetail(
  categorySlug: string,
  detail: Record<string, string | number>,
): string | null {
  for (const field of CATEGORY_FIELDS[categorySlug] ?? []) {
    if (!field.required) continue;
    const value = detail[field.name];
    if (value === undefined || value === "" || value === null) {
      return `${field.label} is required for this category`;
    }
  }
  return null;
}

/** Accepts "180", "180.50", "$180" — returns integer cents, or null. */
export function parseDollarsToCents(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
