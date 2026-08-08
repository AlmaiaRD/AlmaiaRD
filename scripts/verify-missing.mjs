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

// Esperar login
const start = Date.now();
let loggedIn = false;
while (Date.now() - start < 900000) {
  try {
    const txt = await page.evaluate(() => document.body.innerText || "");
    if (/Hola,|Cerrar sesi[oó]n|Mi cuenta|Sign out|Salir|Logout/i.test(txt)) {
      loggedIn = true;
      console.log("✅ Login OK\n");
      break;
    }
  } catch {}
  await page.waitForTimeout(3000);
}
if (!loggedIn) {
  console.log("⚠️ Sin login. Continuando de todos modos (búsquedas públicas)...");
}

// Productos a verificar por nombre (de la lista "no vistos")
const queries = [
  { code: "124150", name: "Lápiz labial cremoso Artistry Go Vibrant Take Charge Red 107" },
  { code: "124156", name: "Lápiz labial mate Artistry Go Vibrant Photobomb Fuchsia 202" },
  { code: "126741", name: "Lápiz delineador de ojos Artistry Go Vibrant Natural Brown" },
  { code: "126745", name: "Lápiz y color en gel para cejas Artistry Go Vibrant True Black" },
  { code: "127453", name: "Base de larga duración Artistry Ever Perfect Beige 201" },
  { code: "127472", name: "Rubor en crema y polvo Artistry Go Vibrant Peachy Days" },
  { code: "127830", name: "Corrector de sérum Artistry Future Glow Deep" },
  { code: "127844", name: "Compacto de Base en polvo Artistry Ever Perfect" },
  { code: "127845", name: "Rímel de volumen 3 en 1 Artistry Go Vibrant" },
  { code: "A4300DR", name: "Nutrilite Double X suministro para 31 días" },
  { code: "126740", name: "Rímel suero de longitud Artistry Go Vibrant" },
];

for (const q of queries) {
  const url = `https://www.amway.com.do/es_DO/search/?text=${encodeURIComponent(q.name)}`;
  console.log(`🔍 ${q.code} — ${q.name}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(2500);
    const res = await page.evaluate(() => {
      const txt = document.body.innerText || "";
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({ href: a.getAttribute("href"), text: (a.textContent || "").replace(/\s+/g, " ").trim() }))
        .filter(l => l.href && (l.href.includes("/es_DO/p/") || l.href.includes("-p-")) && l.text.length > 3)
        .slice(0, 6);
      return { noResults: /no\s*(se)?\s*encontr|sin\s*resultados|0\s*resultados/i.test(txt), links };
    });
    if (res.noResults) {
      console.log("   ➖ NO ENCONTRADO (descontinuado o no disponible)");
    } else {
      for (const l of res.links) {
        const m = l.href.match(/\/es_DO\/p\/([0-9A-Za-z]+)$/) || l.href.match(/\/p\/([0-9A-Za-z]+)$/) || l.href.match(/-p-([0-9A-Za-z]+)$/);
        console.log(`   🆗 ${m ? m[1] : "?"} | ${l.text.substring(0, 70)}`);
      }
      if (res.links.length === 0) console.log("   ➖ Sin enlaces de producto en resultados");
    }
  } catch (err) {
    console.log(`   ⚠️  Error: ${err.message}`);
  }
}

await browser.close();
console.log("\n✅ Verificación completa");
