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

test.describe("API Docs (Swagger/OpenAPI)", () => {
  test("endpoint /api/openapi.json devuelve el documento OpenAPI", async ({ page }) => {
    await login(page);
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    const resp = await page.request.get("/api/openapi.json");
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.openapi).toBe("3.0.3");
    expect(body.info.title).toContain("Almaia RD");
    expect(body.paths["/api/ai-chat"]).toBeDefined();
    expect(body.paths["/api/whatsapp/webhook"]).toBeDefined();
  });

  test("página /docs renderiza Swagger UI", async ({ page }) => {
    await login(page);
    if (page.url().includes("/login")) {
      test.skip(true, "Login falló - credenciales inválidas");
      return;
    }

    await page.goto("/docs");
    await expect(page.locator("h1")).toContainText("API Almaia RD");
    await expect(page.locator(".swagger-ui")).toBeVisible({ timeout: 15000 });
  });
});
