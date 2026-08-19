import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * These are real end-to-end runs against a real database and Stripe test mode.
 * Three things must be running before `npm run e2e`:
 *
 *   1. a Supabase instance with the migrations applied and seed.sql loaded
 *      (`./init.sh local` or `./init.sh hosted`)
 *   2. Stripe test keys in .env.local
 *   3. `stripe listen --forward-to localhost:3000/api/stripe/webhook`, because
 *      the order does not leave pending_payment without the webhook — the
 *      success redirect is deliberately not trusted
 *
 * Nothing here stubs Stripe. A green run means money actually moved in test mode.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Pacific/Auckland",
    locale: "en-NZ",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
