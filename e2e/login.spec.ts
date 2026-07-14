import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("should render login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error on invalid email", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("invalid");
    await page.locator('input[type="password"]').fill("123");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=Email inválido")).toBeVisible();
  });
});
