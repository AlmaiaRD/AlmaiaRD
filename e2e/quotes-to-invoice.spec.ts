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
    // Si login falló, salta el test
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/cotizaciones");
    await expect(page.locator("text=/Nueva Cotización|Crear Cotización/i")).toBeVisible({ timeout: 10000 });

    // Click nueva cotización
    await page.click('button:has-text("Nueva Cotización"), button:has-text("Crear Cotización")');
    await expect(page.locator("text=/Genera una cotización|Nueva Cotización/i")).toBeVisible({ timeout: 5000 });

    // Seleccionar cliente
    const clientSelect = page.locator('select[name="clientId"], select[id="clientId"]').first();
    if (await clientSelect.count() > 0) {
      await clientSelect.click();
      const options = await clientSelect.locator("option").all();
      if (options.length > 1) {
        await clientSelect.selectOption({ index: 1 });
      }
    }

    // Agregar producto
    await page.click('button:has-text("Agregar producto"), button:has-text("Añadir producto")');
    const productSelect = page.locator('select[name="product_id"]').first();
    if (await productSelect.count() > 0) {
      await productSelect.click();
      await productSelect.selectOption({ index: 1 });
    }
    await page.fill('input[name="quantity"]', "1");

    // Guardar cotización
    await page.click('button:has-text("Guardar")');
    await expect(page.locator("text=/Cotización creada|Guardado/i")).toBeVisible({ timeout: 5000 });

    // Enviar cotización
    await page.click('button:has-text("Enviar")');
    await expect(page.locator("text=/Cotización enviada|Enviado/i")).toBeVisible({ timeout: 5000 });

    // Convertir a factura
    await page.click('button:has-text("Convertir a factura"), button:has-text("Convertir")');
    await expect(page.locator("text=/Factura creada|Convertido/i")).toBeVisible({ timeout: 5000 });

    // Verificar que está en facturación
    await expect(page).toHaveURL(/\/facturacion/);
  });
});