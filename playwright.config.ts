import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Por defecto se apunta a localhost: ejecutar E2E en local nunca debe golpear
// producción por accidente. Para probar un despliegue concreto,
// Playwright usa la variable PLAYWRIGHT_BASE_URL (así lo hace el job de CI en
// .github/workflows/e2e.yml, que sí debe exercitar la URL desplegada).
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer: el servidor se levanta aparte (`npm run dev` / `npm run build && npm start`).
  // Con la URL por defecto en localhost, si no hay servidor los tests fallan
  // contra localhost en vez de atacar producción.
});