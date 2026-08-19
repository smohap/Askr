import "server-only";
import Stripe from "stripe";

/**
 * The Stripe client, created on first use rather than at module load.
 *
 * Next collects page data by importing every route module, so a client
 * constructed at the top level would make STRIPE_SECRET_KEY a build-time
 * requirement — and it is a runtime secret. Lazily is also the only way a
 * build with no Stripe keys can succeed.
 *
 * No apiVersion is pinned: the SDK version in package.json is the pin, so
 * upgrading is one dependency bump rather than two edits that can disagree.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { typescript: true });
  }
  return client;
}

/** Absolute URLs for Stripe redirects, which cannot be relative. */
export function siteUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString();
}
