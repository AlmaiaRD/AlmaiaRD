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
  args: ["--start-maximized"],
  viewport: null,
  locale: "es-DO",
  ignoreHTTPSErrors: true,
});

const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://www.amway.com.do/es_DO", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);

const start = Date.now();
while (Date.now() - start < 900000) {
  try {
    const txt = await page.evaluate(() => document.body.innerText || "");
    if (/Hola,|Cerrar sesi[oó]n|Mi cuenta|Sign out|Salir|Logout/i.test(txt)) { console.log("Login OK"); break; }
  } catch {}
  await page.waitForTimeout(3000);
}

for (const code of [326, 114, 351]) {
  await page.goto("https://www.amway.com.do/es_DO/c/" + code, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);
  try {
    const sel = page.locator("select[name=itemsPerPage]").first();
    if (await sel.count()) { await sel.selectOption("all"); await page.waitForTimeout(4000); }
  } catch {}

  // scroll
  for (let i = 0; i < 8; i++) {
    const prev = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const next = await page.evaluate(() => document.body.scrollHeight);
    if (next === prev) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  const info = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]"));
    const codes = [];
    const names = [];
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      let m = href.match(/\/es_DO\/p\/([0-9A-Za-z]+)$/) || href.match(/\/p\/([0-9A-Za-z]+)$/);
      if (!m) m = href.match(/-p-([0-9A-Za-z]+)$/);
      if (!m) continue;
      if (!/^\d{4,6}[A-Za-z]{0,3}$/.test(m[1])) continue;
      codes.push(m[1]);
      const t = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (t) names.push(t);
    }
    const body = document.body.innerText || "";
    const m = body.match(/\d+[.\s]?\s*RESULTADOS?/i) || body.match(/\d+\s*resultados?/i) || body.match(/resultados?/i);
    return { codes, names, resultCount: m ? m[0] : null, bodyLen: body.length, url: location.href };
  });

  console.log("\n=== c/" + code + " ===");
  console.log("URL:", info.url);
  const uniq = [...new Set(info.codes)];
  console.log("Códigos (" + uniq.length + "):", uniq.join(", ") || "(ninguno)");
  console.log("Conteo:", info.resultCount);
  if (info.names.length) console.log("Primer nombre:", info.names[0]);
  console.log("bodyLen:", info.bodyLen);
}

await browser.close();
console.log("\nDone");
