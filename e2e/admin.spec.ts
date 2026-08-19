import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn, signOut } from "./accounts";
import { payWithTestCard, expectOrderState } from "./stripe";

/**
 * The admin's two jobs: deciding who may trade, and deciding what happens to
 * money that is already in escrow.
 */

test("admin verifies a provider from the queue", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/verification");

  const card = page.locator("div", { hasText: "Fresh Start Services" }).last();
  await expect(card).toBeVisible();

  // Rejecting without a reason is refused — the provider would have nothing to fix.
  await card.getByRole("button", { name: "Reject provider" }).click();
  await card.getByRole("button", { name: /confirm rejection/i }).click();
  await expect(card.getByRole("textbox")).toHaveAttribute("required", "");
  await card.getByRole("button", { name: /^cancel$/i }).click();

  await card.getByRole("button", { name: /approve document/i }).first().click();
  await expect(page.getByText("approved").first()).toBeVisible();

  await page.getByRole("button", { name: /verify provider/i }).click();
  await expect(page.getByText("Fresh Start Services")).toHaveCount(0);

  // The queue count on the overview moves with it.
  await page.goto("/admin");
  await expect(page.getByText(/awaiting verification/i)).toBeVisible();
});

test("admin resolves a dispute with a full refund", async ({ page }) => {
  const title = `E2E disputed job ${Date.now()}`;

  // ---- get an order into escrow ----------------------------------------
  await signIn(page, ACCOUNTS.buyer);
  await page.goto("/requests/new");
  await page.getByLabel("What do you need").fill(title);
  await page.getByLabel("Details").fill("Two-bedroom flat, end of tenancy clean, oven included.");
  await page.getByRole("button", { name: "Home services" }).click();
  await page.getByLabel("Location").selectOption("Mount Eden, Auckland");
  await page.getByRole("button", { name: /post request/i }).click();

  await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
  const requestUrl = page.url();
  const requestId = requestUrl.split("/").pop()!;
  await signOut(page);

  await signIn(page, ACCOUNTS.provider);
  await page.goto(`/provider/feed/${requestId}`);
  await page.getByLabel("Your price (NZD)").fill("170");
  await page.getByLabel("What the buyer gets").fill("End of tenancy clean including the oven.");
  await page.getByRole("button", { name: /send offer/i }).click();
  await expect(page.getByText(/withdraw offer/i)).toBeVisible();
  await signOut(page);

  await signIn(page, ACCOUNTS.buyer);
  await page.goto(requestUrl);
  await page.getByText("Sparkle Clean Co.").first().click();
  await page.getByRole("button", { name: /accept & pay/i }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}\/pay$/);

  const orderUrl = page.url().replace(/\/pay$/, "");
  await page.getByRole("button", { name: /pay & confirm/i }).click();
  await payWithTestCard(page);

  // ---- buyer raises a dispute -------------------------------------------
  await page.goto(orderUrl);
  await page.getByRole("button", { name: /raise a dispute/i }).click();
  await page
    .getByRole("textbox")
    .fill("The provider never arrived and stopped answering messages.");
  await page.getByRole("button", { name: /^raise dispute$/i }).click();

  await expectOrderState(page, /disputed/i);
  await expect(page.getByText(/this order is with an admin/i)).toBeVisible();
  await signOut(page);

  // ---- admin refunds ----------------------------------------------------
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/disputes");
  await page.getByText(title).click();
  await page.waitForURL(/\/admin\/disputes\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: /^Refund$/ }).click();
  await page
    .getByRole("textbox")
    .fill("No-show confirmed against the message thread. Refunding the buyer in full.");
  await page.getByRole("button", { name: /refund the buyer in full/i }).click();

  await expect(page.getByText(/resolved — refunded/i)).toBeVisible({ timeout: 60_000 });
  await signOut(page);

  // ---- the buyer sees a terminal, refunded order ------------------------
  await signIn(page, ACCOUNTS.buyer);
  await page.goto(orderUrl);
  await expectOrderState(page, /refunded/i);
  await expect(page.getByRole("button", { name: /confirm completion/i })).toHaveCount(0);
});
