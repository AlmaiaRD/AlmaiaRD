import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = [
  "/dashboard", "/catalogo", "/clientes", "/crm", "/pipeline", "/cuentas-por-cobrar",
  "/facturacion", "/recibos", "/devoluciones", "/creditos", "/compras", "/proveedores",
  "/inventario", "/gastos", "/bonificaciones", "/pv", "/reportes", "/documentos",
  "/recomendaciones", "/comunicaciones", "/whatsapp", "/aprendizaje", "/configuracion",
];

const SAFE = /filtro|limpiar|todas|todos|cerrar|abr|más|opciones|anterior|siguiente|nuev|agreg|crear|editar|ver |detalle|aplicar|buscar|descargar|export|imprimir|pdf|actualizar|recargar|volver|avanzado|mostrar/i;
const DANGEROUS = /eliminar|borrar|anular|cancelar|archivar|desactivar|restaurar|borrad/i;

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const report = { at: new Date().toISOString(), base: BASE, pages: [] };
const globalErrors = [];
let loginOk = false;

page.on("console", (msg) => {
  if (msg.type() === "error") globalErrors.push(`console: ${msg.text().slice(0, 300)}`);
});
page.on("pageerror", (err) => globalErrors.push(`pageerror: ${String(err).slice(0, 300)}`));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[type="email"]', "admin@almaia.com");
  await page.fill('input[type="password"]', "Admin123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|login/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const url = page.url();
  loginOk = !url.includes("/login");
  console.log("Login:", loginOk ? "OK" : "FALLÓ", url);
} catch (e) {
  console.log("Login exception:", e.message);
}

for (const path of PAGES) {
  const entry = { path, consoleErrors: [], failedRequests: [], httpErrors: [], buttons: [] };
  const pageErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") entry.consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err) => entry.consoleErrors.push(`pageerror: ${String(err).slice(0, 300)}`);
  const onRequestFailed = (req) => entry.failedRequests.push(`${req.method()} ${req.url().slice(0, 160)} ${req.failure()?.errorText || "?"}`);
  const onResponse = (res) => {
    if (res.status() >= 400) entry.httpErrors.push(`${res.status()} ${res.url().slice(0, 160)}`);
  };
  const onDialog = (d) => d.dismiss().catch(() => {});
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  page.on("dialog", onDialog);

  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500);
    if (!entry.consoleErrors.some((e) => e.includes("404"))) {
      const buttons = await page.$$eval("button", (els) =>
        els.map((b) => ({
          text: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
          aria: b.getAttribute("aria-label") || "",
          disabled: b.hasAttribute("disabled"),
        }))
      );
      entry.buttons = buttons.filter((b) => b.text || b.aria);
    }
  } catch (e) {
    entry.consoleErrors.push(`navigation: ${e.message.slice(0, 200)}`);
  }

  page.removeListener("console", onConsole);
  page.removeListener("pageerror", onPageError);
  page.removeListener("requestfailed", onRequestFailed);
  page.removeListener("response", onResponse);
  page.removeListener("dialog", onDialog);
  entry.pageErrors = pageErrors;
  report.pages.push(entry);
  console.log(
    `${path}: console=${entry.consoleErrors.length} http=${entry.httpErrors.length} failed=${entry.failedRequests.length} botones=${entry.buttons.length}`
  );
}

await browser.close();
report.globalErrors = globalErrors.slice(0, 50);
const { writeFileSync } = await import("fs");
writeFileSync("/tmp/audit-runtime.json", JSON.stringify(report, null, 2));
console.log("\nReporte guardado en /tmp/audit-runtime.json");
console.log("ERRORES GLOBALES:", globalErrors.length);
