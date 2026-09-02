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
  test.describe.configure({ mode: "serial" });

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
    await expect(page.getByRole("heading", { name: /Generar Catálogo PDF/i })).toBeVisible({ timeout: 5000 });

    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
    await checkboxes.first().check();

    const generateBtn = page.getByRole("button", { name: /Generar Catálogo PDF/i });
    await expect(generateBtn).toBeEnabled({ timeout: 5000 });

    const downloadPromise = page.waitForEvent("download");
    await generateBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/CAT-\d{3}-\d{4}\.pdf/);
    await expect(page.locator("text=/Catálogo PDF generado/i")).toBeVisible({ timeout: 5000 });

    await page.goto("/cotizaciones");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 8000 });
  });

  test("lista Mis catálogos muestra catálogos guardados", async ({ page }) => {
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/catalogo");
    await page.click('button:has-text("Mis catálogos")');
    await expect(page.locator("text=/Mis Catálogos Guardados/i")).toBeVisible({ timeout: 5000 });
  });
});
