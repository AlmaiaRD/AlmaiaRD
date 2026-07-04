import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PRODUCT_URL = process.argv[2] || "https://www.amway.com.do/es_DO/Nutrilite%E2%84%A2-Concentrado-de-frutas-y-verduras-p-102992MX";

(async () => {
  const profileDir = join(homedir(), "Desktop", "AMWAY", "Sistema de Facturacion", "almaia-rd", ".amway-profile");
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1400, height: 900 },
    args: ["--no-first-run"],
    timeout: 30000,
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log("🌐 Abriendo Amway...");
  await page.goto("https://www.amway.com.do/es_DO", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Esperar a que el usuario haga login
  console.log("\n⏳ Si necesitas hacer login, hazlo en Chrome ahora.");
  console.log("   Cuando estés listo, presiona ENTER aquí en la terminal...\n");
  await new Promise(resolve => {
    process.stdin.once("data", resolve);
  });
  console.log("✅ Login completado. Navegando al producto...\n");

  await page.goto(PRODUCT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Screenshot 1: página inicial
  await page.screenshot({ path: "debug-step1-initial.png", fullPage: false });
  console.log("📸 Screenshot 1: debug-step1-initial.png");

  // Dump inicial
  const initialText = await page.evaluate(() => document.body.innerText);
  writeFileSync("debug-step1-text.txt", initialText, "utf-8");
  console.log("📝 Texto inicial: debug-step1-text.txt");

  const initialHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 100000));
  writeFileSync("debug-step1-html.txt", initialHTML, "utf-8");
  console.log("📝 HTML inicial: debug-step1-html.txt (100KB)");

  // Buscar todos los elementos clickeables
  const clickableInfo = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll("button, [role='tab'], summary, h2, h3, h4, [class*='accordion'], [class*='tab'], [class*='Tab']").forEach(el => {
      results.push({
        tag: el.tagName,
        text: (el.textContent || "").trim().substring(0, 100),
        className: (el.className || "").substring(0, 100),
        role: el.getAttribute("role"),
        ariaExpanded: el.getAttribute("aria-expanded"),
        id: el.id,
      });
    });
    return results;
  });
  writeFileSync("debug-clickable.json", JSON.stringify(clickableInfo, null, 2), "utf-8");
  console.log(`🔍 Elementos clickeables: ${clickableInfo.length} (debug-clickable.json)`);

  // Intentar clickear tabs uno por uno
  const tabSelectors = [
    "text=Detalles del producto",
    "text=Detalles",
    "text=Ingredientes",
    "text=Instrucciones de uso",
    "text=Instrucciones",
    "text=Descripción",
    "text=Description",
    "text=Detail",
    "text=Benefits",
    "text=Beneficios",
  ];

  let tabIdx = 0;
  for (const sel of tabSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        console.log(`\n🖱️  Click en: "${sel}" (texto: "${text?.trim().substring(0, 60)}")`);
        const urlBefore = page.url();
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2000);

        if (page.url() !== urlBefore) {
          console.log(`   ⚠️  Navegó a ${page.url()} — volviendo...`);
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        } else {
          tabIdx++;
          await page.screenshot({ path: `debug-tab${tabIdx}-${sel.replace(/[^a-z0-9]/gi, "_")}.png`, fullPage: false });
          console.log(`   📸 Screenshot: debug-tab${tabIdx}-*.png`);
          const afterText = await page.evaluate(() => document.body.innerText);
          writeFileSync(`debug-tab${tabIdx}-text.txt`, afterText, "utf-8");
        }
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }

  // Screenshot final full page
  await page.screenshot({ path: "debug-final-fullpage.png", fullPage: true });
  console.log("\n📸 Screenshot final full-page: debug-final-fullpage.png");

  console.log("\n✅ Diagnóstico completo. Revisa los archivos debug-* en la carpeta del proyecto.");
  await ctx.close();
})();
