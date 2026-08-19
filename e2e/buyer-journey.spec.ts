import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn, signOut } from "./accounts";
import { payWithTestCard, expectOrderState } from "./stripe";

/**
 * The core loop, end to end and in one browser context:
 *
 *   buyer posts → provider offers → buyer accepts and pays → provider starts
 *   and delivers → buyer confirms, the money is transferred, buyer reviews.
 *
 * Nothing is stubbed. The order only leaves pending_payment when Stripe's
 * webhook says so, so a green run means `stripe listen` delivered and the
 * escrow state machine accepted every move.
 */
test("buyer posts, provider offers, escrow runs to release and review", async ({ page }) => {
  const title = `E2E house clean ${Date.now()}`;

  // ---- buyer posts a request ------------------------------------------
  await signIn(page, ACCOUNTS.buyer);

  await page.goto("/requests/new");
  await page.getByLabel("What do you need").fill(title);
  await page
    .getByLabel("Details")
    .fill("Four bedrooms, two bathrooms, no pets. Needed before 3pm Saturday.");
  await page.getByRole("button", { name: "Home services" }).click();
  await page.getByLabel("Location").selectOption("Mount Eden, Auckland");
  await page.getByRole("button", { name: /post request/i }).click();

  await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
  const requestUrl = page.url();
  const requestId = requestUrl.split("/").pop()!;
  await expect(page.getByText(/broadcasting your request/i)).toBeVisible();

  await signOut(page);

  // ---- provider makes an offer ----------------------------------------
  await signIn(page, ACCOUNTS.provider);
  await page.goto(`/provider/feed/${requestId}`);
  await expect(page.getByText(title)).toBeVisible();

  await page.getByLabel("Your price (NZD)").fill("170");
  await page
    .getByLabel("What the buyer gets")
    .fill("Full four-bedroom clean, eco products, two cleaners, about three hours.");
  await page.getByRole("button", { name: /send offer/i }).click();
  await expect(page.getByText(/withdraw offer/i)).toBeVisible();

  await signOut(page);

  // ---- buyer accepts and pays ------------------------------------------
  await signIn(page, ACCOUNTS.buyer);
  await page.goto(requestUrl);

  await page.getByText("Sparkle Clean Co.").first().click();
  await page.waitForURL(/\/offers\/[0-9a-f-]{36}$/);

  // 5% commission on $170.00 — the money model, rendered.
  await expect(page.getByText("$178.50")).toBeVisible();

  await page.getByRole("button", { name: /accept & pay/i }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}\/pay$/);

  const orderUrl = page.url().replace(/\/pay$/, "");
  await expect(page.getByText("$178.50")).toBeVisible();

  await page.getByRole("button", { name: /pay & confirm/i }).click();
  await payWithTestCard(page);

  await signOut(page);

  // ---- provider works the job ------------------------------------------
  await signIn(page, ACCOUNTS.provider);
  const orderId = orderUrl.split("/").pop()!;
  await page.goto(`/provider/jobs/${orderId}`);

  await page.getByRole("button", { name: /start the job/i }).click();
  await expect(page.getByRole("button", { name: /mark delivered/i })).toBeVisible();

  await page.getByRole("button", { name: /mark delivered/i }).click();
  await expect(page.getByText(/provider marked it done/i)).toBeVisible();

  await signOut(page);

  // ---- buyer confirms, money moves, buyer reviews -----------------------
  await signIn(page, ACCOUNTS.buyer);
  await page.goto(orderUrl);

  await page.getByRole("button", { name: /confirm completion/i }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}\/review$/, { timeout: 60_000 });

  await expect(page.getByText(/job complete/i)).toBeVisible();
  await expect(page.getByText("$178.50")).toBeVisible();

  await page.getByRole("button", { name: "5 stars" }).click();
  await page.getByPlaceholder(/great job/i).fill("On time, thorough, left the place spotless.");
  await page.getByRole("button", { name: /post review/i }).click();
  await page.waitForURL(/\/requests$/);

  // The order is terminal and the review is on it.
  await page.goto(orderUrl);
  await expectOrderState(page, /released/i);
  await expect(page.getByRole("link", { name: /leave a review/i })).toHaveCount(0);
});
