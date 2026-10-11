import { expect, test } from "@playwright/test";
import { login } from "./utils";

test.describe("authenticated smoke", () => {
  test("owner signs in and sees the dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  });

  test("every main route renders without a server error", async ({ page }) => {
    await login(page);

    const routes = [
      "/en",
      "/en/pos",
      "/en/sales",
      "/en/products",
      "/en/inventory",
      "/en/inventory/movements",
      "/en/inventory/transfers",
      "/en/customers",
      "/en/suppliers",
      "/en/purchasing",
      "/en/expenses",
      "/en/employees",
      "/en/branches",
      "/en/reports",
      "/en/settings",
      "/en/subscription",
    ];

    for (const route of routes) {
      const res = await page.goto(route);
      expect(res?.status(), `${route} status`).toBeLessThan(400);
      await expect(page.locator("text=Application error"), route).toHaveCount(0);
    }
  });
});
