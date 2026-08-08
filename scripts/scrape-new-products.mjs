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

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function parseNumber(text) {
  if (!text) return 0;
  const cleaned = (text || "").replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastDot > lastComma) return parseFloat(cleaned.replace(/,/g, "")) || 0;
    else return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) return parseFloat(cleaned.replace(",", ".")) || 0;
    return parseFloat(cleaned.replace(/,/g, "")) || 0;
  } else if (hasDot) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    if (last.length <= 2 && parts.length > 1) return parseFloat(cleaned) || 0;
    return parseFloat(cleaned.replace(/\./g, "")) || 0;
  }
  return parseFloat(cleaned) || 0;
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

// Buscar ambos productos para localizar sus URLs
const targets = [
  { code: "A0244DR", search: "Double X Reemplazo" },
  { code: "E3878S", search: "Pursue Limpiador desinfectante" },
];

const productUrls = [];
for (const t of targets) {
  console.log(`\n🔎 Buscando: ${t.search}`);
  await page.goto(`https://www.amway.com.do/es_DO/search/?text=${encodeURIComponent(t.search)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  try {
    const sel = page.locator("select[name=itemsPerPage]").first();
    if (await sel.count()) { await sel.selectOption("all"); await page.waitForTimeout(3500); }
  } catch {}
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const results = await page.evaluate((code) => {
    const found = [];
    const links = document.querySelectorAll("a[href]");
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      let m = href.match(/\/es_DO\/p\/([0-9A-Za-z]+)$/) || href.match(/\/p\/([0-9A-Za-z]+)$/);
      if (!m) m = href.match(/-p-([0-9A-Za-z]+)$/);
      if (!m) continue;
      const c = m[1];
      const name = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (c.toUpperCase().includes(code) || (name && /Double X|Pursue/i.test(name))) {
        found.push({ code: c, name, url: href.startsWith("http") ? href : "https://www.amway.com.do" + href });
      }
    }
    return found;
  }, t.code);

  const uniq = [...new Map(results.map(r => [r.code, r])).values()];
  console.log(`   ${uniq.length} resultados candidatos:`);
  for (const r of uniq.slice(0, 10)) console.log(`   ${r.code} | ${r.name} | ${r.url}`);
  const match = uniq.find(r => r.code.toUpperCase() === t.code) || uniq[0];
  if (match) productUrls.push(match);
}

// Scrapear cada producto
console.log("\n\n📦 Scrapeando productos...");
for (const target of productUrls) {
  console.log(`\n===== ${target.code} | ${target.name} =====`);
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  // Clic en tabs de detalles
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

  // Precio IBO
  let cost = 0;
  const costIdx = data.lines.findIndex(l => /Costo\s*al?\s*IBO|Precio\s*IBO|Costo\s*IBO/i.test(l));
  if (costIdx >= 0) {
    const seg = data.lines.slice(costIdx, costIdx + 3).join(" ");
    cost = parseNumber(seg);
  }
  if (cost === 0) {
    const priceLine = data.lines.find(l => /\$\s*[\d,.]+/.test(l) && !/total|envío/i.test(l));
    if (priceLine) cost = parseNumber(priceLine);
  }

  // PV
  let pv = 0;
  for (let i = 0; i < data.lines.length; i++) {
    if (/PV\/BV/i.test(data.lines[i])) {
      const seg = data.lines.slice(i, i + 2).join(" ");
      const m = seg.match(/PV\/BV\s*[:\s]*([\d.]+)/i) || seg.match(/([\d.]+)/);
      if (m) pv = parseNumber(m[1]);
      break;
    }
  }

  // Contenido (detalles, ingredientes, instrucciones, preguntas)
  const sections = {};
  const sectionKeys = [
    [/detalles del producto/i, "detalles"],
    [/^detalles$/i, "detalles"],
    [/ingredientes/i, "ingredientes"],
    [/instrucciones de uso/i, "instrucciones"],
    [/^instrucciones$/i, "instrucciones"],
    [/preguntas frecuentes/i, "preguntas"],
  ];
  const headings = [];
  for (let i = 0; i < data.lines.length; i++) {
    const lower = data.lines[i].toLowerCase().trim();
    for (const [re, label] of sectionKeys) {
      if (re.test(lower) && lower.length < 50) { headings.push({ idx: i, label }); break; }
    }
  }
  for (let t = 0; t < headings.length; t++) {
    const s = headings[t].idx + 1;
    const e = t + 1 < headings.length ? headings[t + 1].idx : Math.min(s + 40, data.lines.length);
    const content = data.lines.slice(s, e).filter(l => !/detalles del producto|ingredientes|instrucciones de uso|preguntas frecuentes/i.test(l)).join("\n").trim();
    if (content.length > 5) sections[headings[t].label] = content.substring(0, 2500);
  }

  // Párrafos largos
  const longP = data.lines.filter(l => l.length > 40 && !/\$|RD\$|carrito|comprar|Envío|impuesto|Costo al IBO|PV\/BV|Artículo/i.test(l)).slice(0, 8);

  console.log(`Nombre: ${data.name}`);
  console.log(`Imagen: ${data.image}`);
  console.log(`Costo (IBO): ${cost}`);
  console.log(`PV: ${pv}`);
  console.log(`--- secciones ---`);
  for (const [k, v] of Object.entries(sections)) {
    console.log(`[${k}] ${v.substring(0, 250)}`);
    console.log("...");
  }
  console.log(`--- párrafos largos ---`);
  for (const p of longP) console.log("P:", p.substring(0, 200));
}

await browser.close();
console.log("\n✅ Scraping completo");
