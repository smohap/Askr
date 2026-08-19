import { expect, type Page } from "@playwright/test";
import { TEST_CARD } from "./accounts";

/**
 * Pay through Stripe's hosted Checkout with the test card, then wait for the
 * webhook to actually move the order.
 *
 * The success redirect proves only that the browser came back. The order page
 * is server-rendered, so it will keep showing `pending_payment` until the
 * webhook lands — which is exactly the property being tested, and why this
 * reloads rather than waits on the first render.
 */
export async function payWithTestCard(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });

  await page.getByPlaceholder("1234 1234 1234 1234").fill(TEST_CARD.number);
  await page.getByPlaceholder("MM / YY").fill(TEST_CARD.expiry);
  await page.getByPlaceholder("CVC").fill(TEST_CARD.cvc);

  const name = page.getByPlaceholder("Full name on card");
  if (await name.isVisible().catch(() => false)) await name.fill(TEST_CARD.name);

  await page.getByTestId("hosted-payment-submit-button").click();

  await page.waitForURL(/\/orders\/[^/]+\?paid=1/, { timeout: 60_000 });
  await expectOrderState(page, /escrow held/i);
}

/** Reload the order page until the state badge says what we are waiting for. */
export async function expectOrderState(page: Page, state: RegExp) {
  await expect
    .poll(
      async () => {
        await page.reload();
        return await page.locator("body").innerText();
      },
      { timeout: 45_000, intervals: [1000, 2000, 3000] },
    )
    .toMatch(state);
}
