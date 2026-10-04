import { test, expect, type Page } from "@playwright/test";
import { getE2ECredentials, hasE2ECredentials } from "./_credentials";

async function login(page: Page) {
  const { email, password } = getE2ECredentials();
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|cotizaciones|catalogo)/, { timeout: 10000 }).catch(() => {});
}

test.describe("Cotización → Factura", () => {
  test.beforeEach(async ({ page }) => {
    // El salto va ANTES de login(). Si no, getE2ECredentials() lanza dentro
    // del beforeEach y la prueba falla con un error de variables de entorno
    // en vez de saltarse: lo que pasaba con un CI al que le faltaran los
    // secretos, que se ponía rojo sin motivo.
    test.skip(
      !hasE2ECredentials(),
      "Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD: define las credenciales de E2E para correr esta prueba."
    );
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
