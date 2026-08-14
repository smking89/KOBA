import { test, expect } from "@playwright/test";

test("home shell renders brand and foundation badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /KOBA/i }).first()).toBeVisible();
  await expect(page.getByText(/Phase 1/i).first()).toBeVisible();
});
