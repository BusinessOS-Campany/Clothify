import { expect, type Page } from "@playwright/test";

/** Signs in via the login form and waits for the redirect away from /login. */
export async function login(
  page: Page,
  identifier = "owner@zahra.local",
  password = "owner123",
) {
  await page.goto("/en/login");
  await page.fill("#identifier", identifier);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Clicks the first in-stock product variant button in the POS catalogue. */
export async function addFirstAvailableVariant(page: Page) {
  const variants = page.getByRole("button").filter({ hasText: "$" });
  const count = await variants.count();
  for (let i = 0; i < count; i++) {
    const button = variants.nth(i);
    if (await button.isEnabled()) {
      await button.click();
      return;
    }
  }
  throw new Error("No in-stock product variant found in the POS catalogue");
}
