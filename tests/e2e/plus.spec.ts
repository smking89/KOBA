import { test, expect } from "@playwright/test";

test("plus page explains optional membership and stays keyboard reachable", async ({ page }) => {
  await page.goto("/plus");
  await expect(page.getByRole("heading", { name: /optional membership/i })).toBeVisible();
  await expect(page.getByText(/security, moderation, accessibility/i)).toBeVisible();
  await expect(page.getByText("Coming later").first()).toBeVisible();
  await page.keyboard.press("Tab");
});
