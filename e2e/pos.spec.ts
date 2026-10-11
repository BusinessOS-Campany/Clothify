import { expect, test } from "@playwright/test";
import { addFirstAvailableVariant, login } from "./utils";

test("cash sale completes and shows a receipt", async ({ page }) => {
  await login(page);

  await page.goto("/en/pos");
  await addFirstAvailableVariant(page);

  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page.getByRole("button", { name: /Complete sale/i }).click();

  await expect(page.getByText("Sale completed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Print receipt/i })).toBeVisible();
});
