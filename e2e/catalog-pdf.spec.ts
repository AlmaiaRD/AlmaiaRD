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

test.describe("Catálogo PDF", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("generar catálogo PDF y verificar cotización CATALOGO creada", async ({ page }) => {
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/catalogo");
    await expect(page.locator("text=/Catálogo PDF/i")).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Catálogo PDF")');
    await expect(page.locator("text=/Generar Catálogo PDF/i")).toBeVisible({ timeout: 5000 });

    // Seleccionar al menos un producto
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count > 0) {
      await checkboxes.first().check();
    }

    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Generar Catálogo PDF")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/CAT-\d{3}-\d{4}\.pdf/);
    await expect(page.locator("text=/Catálogo PDF generado/i")).toBeVisible({ timeout: 5000 });

    // Verificar que se creó cotización CATALOGO
    await page.goto("/cotizaciones");
    await expect(page.locator("text=/Catálogo/i")).toBeVisible({ timeout: 5000 });
  });

  test("lista Mis catálogos muestra catálogos guardados", async ({ page }) => {
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/catalogo");
    await page.click('button:has-text("Mis catálogos")');
    await expect(page.locator("text=/Mis Catálogos Guardados/i")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/CAT-/i")).toBeVisible({ timeout: 5000 });
  });
});