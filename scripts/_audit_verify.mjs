import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const CHECKS = ["/facturacion", "/catalogo", "/inventario", "/recibos", "/comunicaciones", "/configuracion"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const seen = new Set();
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("/rest/v1/") || u.includes("/rest/v1/rpc/")) seen.add(u.replace(/^.*?\/rest\/v1\//, "").split("?")[0]);
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "admin@almaia.com");
await page.fill('input[type="password"]', "Admin123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

for (const path of CHECKS) {
  seen.clear();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("button", { timeout: 10000 });
  } catch { /* seguir */ }
  await page.waitForTimeout(2000);
  const n = await page.locator("button").count();
  const h = await page.locator("h1,h2").first().textContent().catch(() => "");
  console.log(`${path}: botones=${n} titulo="${(h||'').trim().slice(0,40)}" settingsRequest=${[...seen].includes("settings")}`);
  await page.screenshot({ path: `/tmp/audit-shot-${path.replace(/\//g, "_")}.png` });
}
await browser.close();
console.log("listo");
