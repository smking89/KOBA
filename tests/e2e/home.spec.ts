import { test, expect } from "@playwright/test";

test("home shell renders brand and marketplace headline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /KOBA/i }).first()).toBeVisible();
  await expect(page.getByText(/Trade what you build/i).first()).toBeVisible();
});
