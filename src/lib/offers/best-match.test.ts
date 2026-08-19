import { describe, expect, it } from "vitest";
import { findBestMatch, sortOffers, type SortableOffer } from "./best-match";

const offer = (over: Partial<SortableOffer> & { id: string }): SortableOffer => ({
  priceCents: 10_000,
  createdAt: "2026-08-01T00:00:00.000Z",
  providerRating: 4.5,
  providerRatingCount: 10,
  etaMinutes: 60,
  distanceKm: 5,
  ...over,
});

describe("findBestMatch", () => {
  it("picks the cheapest among the top-rated band", () => {
    // The mockup's three offers: 4.9/$170, 4.8/$160, 5.0/$190.
    // 5.0 and 4.9 are within the band; 4.8 is not. So $170 wins, not $160.
    const best = findBestMatch([
      offer({ id: "sparkle", providerRating: 4.9, priceCents: 17_000 }),
      offer({ id: "maidbright", providerRating: 4.8, priceCents: 16_000 }),
      offer({ id: "bestclean", providerRating: 5.0, priceCents: 19_000 }),
    ]);

    expect(best?.id).toBe("sparkle");
  });

  it("does not let a cheap low-rated offer win", () => {
    const best = findBestMatch([
      offer({ id: "cheap", providerRating: 3.1, priceCents: 1_000 }),
      offer({ id: "good", providerRating: 4.9, priceCents: 20_000 }),
    ]);

    expect(best?.id).toBe("good");
  });

  it("ignores providers with no ratings yet", () => {
    const best = findBestMatch([
      offer({ id: "unrated", providerRating: 0, providerRatingCount: 0, priceCents: 500 }),
      offer({ id: "rated", providerRating: 4.2, priceCents: 30_000 }),
    ]);

    expect(best?.id).toBe("rated");
  });

  it("returns null when nobody has a rating", () => {
    expect(
      findBestMatch([offer({ id: "a", providerRatingCount: 0 }), offer({ id: "b", providerRatingCount: 0 })]),
    ).toBeNull();
  });

  it("returns null for an empty stack", () => {
    expect(findBestMatch([])).toBeNull();
  });

  it("breaks a price tie on the earlier offer, so the badge does not shuffle", () => {
    const best = findBestMatch([
      offer({ id: "later", createdAt: "2026-08-02T00:00:00.000Z" }),
      offer({ id: "earlier", createdAt: "2026-08-01T00:00:00.000Z" }),
    ]);

    expect(best?.id).toBe("earlier");
  });

  it("is stable regardless of input order", () => {
    const a = offer({ id: "a", providerRating: 4.9, priceCents: 17_000 });
    const b = offer({ id: "b", providerRating: 5.0, priceCents: 19_000 });
    const c = offer({ id: "c", providerRating: 4.8, priceCents: 16_000 });

    expect(findBestMatch([a, b, c])?.id).toBe("a");
    expect(findBestMatch([c, b, a])?.id).toBe("a");
    expect(findBestMatch([b, a, c])?.id).toBe("a");
  });
});

describe("sortOffers", () => {
  const stack = [
    offer({ id: "a", priceCents: 17_000, providerRating: 4.9, etaMinutes: 45, distanceKm: 2.1 }),
    offer({ id: "b", priceCents: 16_000, providerRating: 4.8, etaMinutes: 60, distanceKm: 3.4 }),
    offer({ id: "c", priceCents: 19_000, providerRating: 5.0, etaMinutes: 20, distanceKm: 0.8 }),
  ];

  it("sorts by price ascending", () => {
    expect(sortOffers(stack, "price").map((o) => o.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by rating descending", () => {
    expect(sortOffers(stack, "rating").map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by ETA ascending", () => {
    expect(sortOffers(stack, "eta").map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by distance ascending", () => {
    expect(sortOffers(stack, "distance").map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("puts missing ETA and distance last rather than first", () => {
    const withNulls = [
      offer({ id: "none", etaMinutes: null, distanceKm: null }),
      offer({ id: "some", etaMinutes: 90, distanceKm: 9 }),
    ];

    expect(sortOffers(withNulls, "eta").map((o) => o.id)).toEqual(["some", "none"]);
    expect(sortOffers(withNulls, "distance").map((o) => o.id)).toEqual(["some", "none"]);
  });

  it("does not mutate the input", () => {
    const original = [...stack];
    sortOffers(stack, "price");
    expect(stack).toEqual(original);
  });
});
