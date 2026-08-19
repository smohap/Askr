/**
 * The "Best match" badge.
 *
 * Phase 1 only — this is a documented rule, not a model and not a learned
 * ranking. Stated in full:
 *
 *   Among live offers, look at the highest provider rating on the request.
 *   Any offer whose provider is within RATING_BAND of that rating counts as
 *   top-rated. The best match is the cheapest of those.
 *
 * The band exists because a 4.9 and a 5.0 are not meaningfully different to a
 * buyer, but a $60 price gap is — without it the badge would just follow the
 * rating to two decimal places and ignore price entirely.
 *
 * 0.15 is calibrated against the mockup's own offer stack: 4.9/$170, 4.8/$160,
 * 5.0/$190, with the badge on the 4.9. A wider band (0.2) pulls the 4.8 in and
 * the badge moves to the cheaper offer; no band at all moves it to the dearest.
 * So the band is what separates "near-identical rating, take the cheaper" from
 * "genuinely better rated, worth the money".
 *
 * Ties break on price, then on the earlier offer, so the result is stable and
 * does not shuffle between renders.
 *
 * A provider with no ratings yet cannot be the best match: the rule is
 * "cheapest among the best rated", and an unrated provider has no rating to
 * compare. They still appear in the stack and can still be chosen.
 */

export const RATING_BAND = 0.15;

export type RankableOffer = {
  id: string;
  priceCents: number;
  createdAt: string;
  providerRating: number;
  providerRatingCount: number;
};

export function findBestMatch<T extends RankableOffer>(offers: readonly T[]): T | null {
  const rated = offers.filter((o) => o.providerRatingCount > 0);
  if (rated.length === 0) return null;

  const topRating = Math.max(...rated.map((o) => o.providerRating));
  const contenders = rated.filter((o) => o.providerRating >= topRating - RATING_BAND);

  return (
    [...contenders].sort(
      (a, b) =>
        a.priceCents - b.priceCents ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

export type SortKey = "price" | "rating" | "eta" | "distance";

export type SortableOffer = RankableOffer & {
  etaMinutes: number | null;
  distanceKm: number | null;
};

/** The buyer's sort controls in mockup screen 04. Nulls always sort last. */
export function sortOffers<T extends SortableOffer>(offers: readonly T[], key: SortKey): T[] {
  const last = Number.POSITIVE_INFINITY;

  return [...offers].sort((a, b) => {
    switch (key) {
      case "price":
        return a.priceCents - b.priceCents;
      case "rating":
        return b.providerRating - a.providerRating || a.priceCents - b.priceCents;
      case "eta":
        return (a.etaMinutes ?? last) - (b.etaMinutes ?? last);
      case "distance":
        return (a.distanceKm ?? last) - (b.distanceKm ?? last);
    }
  });
}
