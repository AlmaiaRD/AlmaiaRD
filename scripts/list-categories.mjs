#!/usr/bin/env node

import { chromium } from "playwright";
import { unlinkSync, mkdirSync } from "fs";
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

// Extraer TODOS los enlaces de categoría (/c/NNN) del menú, con texto
const cats = await page.evaluate(() => {
  const result = new Map();
  const links = document.querySelectorAll("a[href]");
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    const m = href.match(/(?:^|\/)(?:es_DO\/)?c\/(\d+)/) || href.match(/\/c\/(\d+)/);
    if (!m) continue;
    const code = m[1];
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const full = href.includes("/es_DO/") ? href : "https://www.amway.com.do/es_DO" + (href.startsWith("/") ? "" : "/") + href;
    if (!result.has(code)) result.set(code, { text, href: full });
  }
  return Array.from(result.entries()).map(([code, v]) => ({ code, ...v }));
});

// Ordenar por código
cats.sort((a, b) => parseInt(a.code) - parseInt(b.code) || a.code.localeCompare(b.code));

console.log(`Total de categorías en el menú: ${cats.length}\n`);
for (const c of cats) {
  console.log(`${c.code} | ${c.text} | ${c.href}`);
}

await browser.close();
console.log("\n✅ Listado completo");
