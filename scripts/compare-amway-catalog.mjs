#!/usr/bin/env node

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

import { adminCredentials } from "./_auth.mjs";
const creds = adminCredentials();
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    console.error("ERROR: No se encuentra .env.local");
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { realtime: { transport: ws }, auth: { persistSession: false } }
);

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function baseCode(code) {
  const m = (code || "").match(/^(\d{4,6})/);
  return m ? m[1] : code || "";
}

// Detección REAL de sesión: solo texto de usuario logueado
function isLoggedIn(txt) {
  return /Hola,|Cerrar sesi[oó]n|Mi cuenta|Sign out|Salir|Logout/i.test(txt || "");
}

async function waitForLogin(page, timeoutMs = 900000) {
  console.log("\n📌 Se abrió Chrome con tu perfil.");
  console.log("👉 La sesión de Amway NO está activa. Inicia sesión manualmente");
  console.log("   (clic en 'Iniciar Sesión' en la página de Amway).");
  console.log("⏳ Esperando login real (máx 15 min)...\n");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const txt = await page.evaluate(() => document.body ? document.body.innerText : "");
      if (isLoggedIn(txt)) {
        console.log("✅ Login detectado. Continuando...\n");
        return true;
      }
    } catch { /* transición */ }
    await page.waitForTimeout(3000);
  }
  console.log("⏰ Tiempo de espera agotado.");
  return false;
}

// Categorías del catálogo Amway RD (descubiertas del menú)
const CATEGORIES = [
  { name: "Nutrición", url: "https://www.amway.com.do/es_DO/c/010" },
  { name: "Belleza", url: "https://www.amway.com.do/es_DO/c/040" },
  { name: "Cuidado personal", url: "https://www.amway.com.do/es_DO/c/020" },
  { name: "Hogar", url: "https://www.amway.com.do/es_DO/c/030" },
  { name: "Vitaminas y Suplementos", url: "https://www.amway.com.do/es_DO/c/124" },
  { name: "Control de Peso", url: "https://www.amway.com.do/es_DO/c/125" },
  { name: "Nutrición deportiva", url: "https://www.amway.com.do/es_DO/c/123" },
  { name: "Bebidas de Energía", url: "https://www.amway.com.do/es_DO/c/122" },
  { name: "Cuidado de la Piel", url: "https://www.amway.com.do/es_DO/c/105" },
  { name: "Maquillaje", url: "https://www.amway.com.do/es_DO/c/104" },
  { name: "Fragrancia", url: "https://www.amway.com.do/es_DO/c/326" },
  { name: "Baño y Cuidado del Cuerpo", url: "https://www.amway.com.do/es_DO/c/101" },
  { name: "Cuidado del Cabello", url: "https://www.amway.com.do/es_DO/c/102" },
  { name: "Cuidado Bucal", url: "https://www.amway.com.do/es_DO/c/103" },
  { name: "Utensilios de Cocina", url: "https://www.amway.com.do/es_DO/c/114" },
  { name: "Lavandería", url: "https://www.amway.com.do/es_DO/c/117" },
  { name: "Tratamiento de Agua", url: "https://www.amway.com.do/es_DO/c/119" },
  { name: "Artículos de limpieza", url: "https://www.amway.com.do/c/1?q=%3Arelevance-default-s%3AcategoryPath%3A%252F1%252F030%3AbrandName%3APursue%3AbrandName%3AAmway%2BHome&text=&pageType=CATEGORY" },
  { name: "Productos nuevos", url: "https://www.amway.com.do/es_DO/c/444?q=%3Arelevance-default-s&pageType=CATEGORY&text=&sort=newest-asc-c" },
  { name: "Compra ya", url: "https://www.amway.com.do/es_DO/c/351" },
];

const BRAND_SEARCHES = [
  { name: "Nutrilite", url: "https://www.amway.com.do/es_DO/search/?text=Nutrilite" },
  { name: "Artistry", url: "https://www.amway.com.do/es_DO/search/?text=Artistry" },
  { name: "XS", url: "https://www.amway.com.do/es_DO/Shop/c/1?q=%3Aname-asc-c%3AbrandName%3AXS&text=&pageType=CATEGORY" },
  { name: "Amway Home", url: "https://www.amway.com.do/es_DO/search/?q=Amway+Home%3Arelevance-default-s&pageType=PRODUCTSEARCH&text=Amway+Home&sort=name-asc-s" },
  { name: "Satinique", url: "https://www.amway.com.do/es_DO/Shop/c/1?q=%3Aname-asc-c%3AbrandName%3ASatinique&text=&pageType=CATEGORY" },
  { name: "eSpring", url: "https://www.amway.com.do/es_DO/search/?text=Espring" },
  { name: "Glister", url: "https://www.amway.com.do/es_DO/search/?text=Glister" },
  { name: "g&h", url: "https://www.amway.com.do/es_DO/search/?text=g%26h" },
  { name: "Espree", url: "https://www.amway.com.do/es_DO/search/?text=Espree" },
];

async function collectCodesFromPage(page, url) {
  const codes = new Map();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    // Verificar que no redirigió al login
    const currentUrl = page.url();
    if (/sso|login|authorize/i.test(currentUrl)) {
      console.log(`   ⚠️  Redirigió a login en ${url}`);
      return codes;
    }

    // Cambiar "Artículos por página" a TODOS para capturar el catálogo completo
    try {
      const select = await page.locator("select[name='itemsPerPage']").first();
      if (await select.count()) {
        await select.selectOption("all");
        await page.waitForTimeout(4000);
      }
    } catch { /* el selector puede no existir en búsquedas */ }

    // Verificar de nuevo que no redirigió al login tras cambiar select
    if (/sso|login|authorize/i.test(page.url())) {
      console.log(`   ⚠️  Redirigió a login en ${url}`);
      return codes;
    }

    // Scroll para cargar todos los productos
    for (let i = 0; i < 10; i++) {
      const prevHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === prevHeight) break;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Recoger enlaces de productos: /es_DO/p/CODIGO  y  -p-CODIGO
    const items = await page.evaluate(() => {
      const result = [];
      const links = document.querySelectorAll("a[href]");
      for (const a of links) {
        const href = a.getAttribute("href");
        if (!href) continue;
        let m = href.match(/\/es_DO\/p\/([0-9A-Za-z]+)$/) || href.match(/\/p\/([0-9A-Za-z]+)$/);
        if (!m) m = href.match(/-p-([0-9A-Za-z]+)$/);
        if (!m) continue;
        const code = m[1];
        if (!/^(?:[A-Za-z]{1,2}\d{2,6}[A-Za-z]{0,4}|\d{4,6}[A-Za-z]{0,3})$/.test(code)) continue;
        const name = (a.textContent || "").replace(/\s+/g, " ").trim();
        result.push({ code, name });
      }
      return result;
    });

    for (const item of items) {
      const base = baseCode(item.code);
      if (!codes.has(base)) {
        codes.set(base, { code: item.code, name: item.name || "", url });
      }
    }
  } catch (err) {
    console.log(`   ⚠️  Error en ${url}: ${err.message}`);
  }
  return codes;
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Comparar catálogo Amway RD vs Almaia       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (authError) {
    console.error("ERROR autenticación:", authError.message);
    process.exit(1);
  }
  console.log("✅ Autenticado en Supabase como admin");

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, code, name, active");
  if (prodErr) {
    console.error("ERROR leyendo productos:", prodErr.message);
    process.exit(1);
  }

  const active = (products || []).filter(p => p.active);
  const activeByBase = new Map();
  for (const p of active) {
    const base = baseCode(p.code);
    if (!activeByBase.has(base)) activeByBase.set(base, p);
  }
  console.log(`📦 Productos activos en Almaia: ${active.length}\n`);

  const userDataDir = resolve(__dirname, "..", ".amway-profile");
  try { mkdirSync(userDataDir, { recursive: true }); } catch {}
  for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try { unlinkSync(resolve(userDataDir, f)); } catch {}
  }

  let browser;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
      viewport: null,
      locale: "es-DO",
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    console.log(`⚠️  Chrome real falló (${err.message}). Usando Chromium...`);
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
      viewport: null,
      locale: "es-DO",
      ignoreHTTPSErrors: true,
    });
  }

  const page = browser.pages()[0] || await browser.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["es-DO", "es", "en"] });
  });

  try {
    await page.goto("https://www.amway.com.do/es_DO", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
  } catch (err) {
    console.log(`⚠️  Página tardó en cargar: ${err.message}`);
  }

  const loggedIn = await waitForLogin(page);

  const allCodes = new Map();
  const visited = new Set();

  const urls = [...CATEGORIES, ...BRAND_SEARCHES];
  for (const cat of urls) {
    if (visited.has(cat.url)) continue;
    visited.add(cat.url);
    console.log(`\n📂 ${cat.name}`);
    const codes = await collectCodesFromPage(page, cat.url);
    let added = 0;
    for (const [base, info] of codes) {
      if (!allCodes.has(base)) {
        allCodes.set(base, info);
        added++;
      }
    }
    console.log(`   ${codes.size} códigos | ${added} nuevos | total acumulado: ${allCodes.size}`);
  }

  console.log(`\n📊 Total de códigos únicos en Amway RD: ${allCodes.size} (sesión: ${loggedIn ? "activa" : "NO activa"})`);

  const missing = [];
  const found = [];
  for (const [base, info] of allCodes) {
    const match = activeByBase.get(base);
    if (match) {
      found.push({ base, amwayCode: info.code, almaiaCode: match.code, name: info.name || match.name });
    } else {
      missing.push({ base, amwayCode: info.code, name: info.name });
    }
  }

  const amwayBases = new Set(allCodes.keys());
  const notSeen = [];
  for (const [base, p] of activeByBase) {
    if (!amwayBases.has(base)) {
      notSeen.push({ base, code: p.code, name: p.name });
    }
  }

  console.log(`\n✅ Encontrados en ambos: ${found.length}`);
  console.log(`\n❌ FALTANTES en Almaia (en Amway RD, no en tu catálogo): ${missing.length}`);
  for (const m of missing.sort((a, b) => (a.base || "").localeCompare(b.base || ""))) {
    console.log(`   ${m.base} | ${m.amwayCode} | ${m.name}`);
  }

  console.log(`\nℹ️  Activos en Almaia NO vistos en Amway (${notSeen.length}):`);
  for (const n of notSeen.sort((a, b) => (a.base || "").localeCompare(b.base || ""))) {
    console.log(`   ${n.base} | ${n.code} | ${n.name}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    logged_in: loggedIn,
    amway_total: allCodes.size,
    almaia_active: active.length,
    found: found.length,
    missing: missing.length,
    not_seen: notSeen.length,
    missing_list: missing,
    not_seen_list: notSeen,
  };
  const reportFile = resolve(__dirname, "..", "amway-comparison-report.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Reporte guardado en: ${reportFile}`);

  await browser.close();
}

main().catch((err) => {
  console.error("ERROR FATAL:", err.message || err);
  process.exit(1);
});
