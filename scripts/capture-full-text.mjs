#!/usr/bin/env node

import { chromium } from "playwright";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const userDataDir = resolve(__dirname, "..", ".amway-profile");
try { mkdirSync(userDataDir, { recursive: true }); } catch {}
for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  try { unlinkSync(resolve(userDataDir, f)); } catch {}
}

const browser = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: "chrome",
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
  viewport: null,
  locale: "es-DO",
  ignoreHTTPSErrors: true,
});

const page = browser.pages()[0] || await browser.newPage();
await page.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => false });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, "languages", { get: () => ["es-DO", "es", "en"] });
});

try {
  await page.goto("https://www.amway.com.do/es_DO", { waitUntil: "domcontentloaded", timeout: 60000 });
} catch (err) { console.log("⚠️ ", err.message); }
await page.waitForTimeout(4000);

const start = Date.now();
while (Date.now() - start < 900000) {
  try {
    const txt = await page.evaluate(() => document.body.innerText || "");
    if (/Hola,|Cerrar sesi[oó]n|Mi cuenta|Sign out|Salir|Logout/i.test(txt)) {
      console.log("✅ Login OK\n");
      break;
    }
  } catch {}
  await page.waitForTimeout(3000);
}

const targets = [
  { code: "A0244DR", url: "https://www.amway.com.do/es_DO/Multivitamina-Double-X%26trade%3B-de-Nutrilite%26trade%3B-%26ndash%3B-Reemplazo-para-31%26nbsp%3Bd%26iacute%3Bas-p-A0244DR" },
  { code: "E3878S", url: "https://www.amway.com.do/es_DO/Pursue%E2%84%A2-Limpiador-desinfectante-concentrado-p-E3878S" },
];

for (const t of targets) {
  console.log(`\n📦 ${t.code}`);
  await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  // Abrir tabs de contenido
  try {
    const clicks = await page.$$("button, [role='tab'], summary, [class*='accordion'] > div > div:first-child");
    for (const el of clicks) {
      try {
        const text = (((await el.textContent()) || "")).toLowerCase().trim();
        if (/detalles|ingredientes|instrucciones|uso|preguntas/i.test(text) && text.length < 60) {
          const before = page.url();
          await el.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(400);
          if (page.url() !== before) { await page.goBack().catch(() => {}); await page.waitForTimeout(800); break; }
        }
      } catch {}
    }
  } catch {}

  const data = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const lines = bodyText.split("\n").map(l => l.trim()).filter(Boolean);
    const h1 = document.querySelector("h1");
    const name = h1 ? h1.textContent.trim() : "";
    const metaOg = document.querySelector("meta[property='og:image']");
    const image = metaOg ? metaOg.getAttribute("content") || "" : "";
    return { bodyText, lines, name, image };
  });

  const outFile = resolve(__dirname, "..", `.scrape-${t.code}.json`);
  writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`   Guardado: ${outFile} (${data.lines.length} líneas, image=${!!data.image})`);
}

await browser.close();
console.log("\n✅ Completo");
