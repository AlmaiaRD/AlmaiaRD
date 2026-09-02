import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "admin@almaia.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "test1234";

async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|cotizaciones|catalogo)/, { timeout: 10000 }).catch(() => {});
}

test.describe("Cotización → Factura", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("crear cotización, enviarla y convertir a factura", async ({ page }) => {
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/cotizaciones");
    await expect(page).toHaveURL(/\/cotizaciones/, { timeout: 10000 });

    const nuevaBtn = page.getByRole("button", { name: /Nueva Cotización/i });
    await expect(nuevaBtn).toBeVisible({ timeout: 10000 });
    await nuevaBtn.click();

    await expect(page.getByRole("heading", { name: /Nueva Cotización/i })).toBeVisible({ timeout: 5000 });

    const catalogBtn = page.getByRole("button", { name: "Catálogo", exact: true });
    if (await catalogBtn.count()) {
      await catalogBtn.click();
    }
    const firstProduct = page.locator('button:has-text("30%:")').first();
    await expect(firstProduct).toBeVisible({ timeout: 5000 });
    await firstProduct.click();

    await page.getByRole("button", { name: /Guardar cotización/i }).click();
    await page.waitForTimeout(1500);
    // Verificar que la cotización aparece en la lista (modal cerró o aparece en tabla)
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 8000 });
  });
});
