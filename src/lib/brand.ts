/**
 * Product identity. Every surface that renders the name or the tagline reads it
 * from here, so a rename is one edit rather than a grep.
 *
 * Note the Postgres schema is still `askr` — that is an infrastructure name
 * chosen at deploy time and is deliberately independent of the brand.
 */

export const BRAND = {
  name: "Servuber",
  /** Lowercase form, for URLs, ids, storage keys and test fixtures. */
  slug: "servuber",
  /**
   * The wordmark splits, with the second half in --signal — per
   * PRD/servuber-logo.html, which renders `Serv<span>uber</span>`.
   */
  nameLead: "Serv",
  nameAccent: "uber",
  tagline: "Service at your choice of price",
  description:
    "Post what you need and set your price. Verified providers across New Zealand compete for the job within minutes.",
} as const;
