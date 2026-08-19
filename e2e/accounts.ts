import type { Page } from "@playwright/test";

/** The seeded accounts from supabase/seed.sql. Development data, one password. */
export const PASSWORD = "servuber-dev-password";

export const ACCOUNTS = {
  buyer: "buyer@servuber.test",
  admin: "admin@servuber.test",
  /** Verified, top-rated — the one the Best match rule picks in the mockup. */
  provider: "sparkle@servuber.test",
  /** Seeded `pending` with two pending documents, for the verification queue. */
  unverifiedProvider: "freshstart@servuber.test",
} as const;

/** Stripe's always-succeeds test card. */
export const TEST_CARD = {
  number: "4242 4242 4242 4242",
  expiry: "12 / 34",
  cvc: "123",
  name: "Servuber Test Buyer",
} as const;

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/");
}
