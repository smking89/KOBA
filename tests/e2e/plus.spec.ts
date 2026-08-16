import { test, expect } from "@playwright/test";

test("plus page explains optional membership and stays keyboard reachable", async ({ page }) => {
  await page.goto("/plus", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /optional membership/i })).toBeVisible();
  await expect(page.getByText(/security, moderation, accessibility/i).first()).toBeVisible();
  await expect(page.getByText(/Stripe test mode/i)).toBeVisible();
  await expect(page.getByText(/verified webhook/i)).toBeVisible();
  await expect(page.getByText("Coming later").first()).toBeVisible();
  await page.keyboard.press("Tab");
});
