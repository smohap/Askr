/** Platform constants. Commission is a constant here, not a billing surface. */

export const CURRENCY = "nzd" as const;
export const TIMEZONE = "Pacific/Auckland" as const;

/**
 * Platform commission, in basis points of the provider's quoted price.
 *
 * 500 bps = 5%, which is what the mockup's confirm-and-pay screen shows:
 * a $170.00 service fee carries an $8.50 platform fee for a $178.50 total.
 * The PRD's 5–12% band is a pricing decision, not a per-order input — Phase 1
 * has no subscription or tier that would vary it.
 */
export const COMMISSION_BPS = 500;

/** Default broadcast radius when a buyer doesn't set one. */
export const DEFAULT_RADIUS_KM = 15;

/** How long an offer stays live if the provider doesn't choose an expiry. */
export const DEFAULT_OFFER_EXPIRY_HOURS = 24;

/** Categories that route in Phase 1. The other twelve are seed rows only. */
export const PHASE1_CATEGORY_SLUGS = [
  "home-services",
  "automotive",
  "electronics",
  "education",
  "events",
  "other",
] as const;

export type Phase1CategorySlug = (typeof PHASE1_CATEGORY_SLUGS)[number];
