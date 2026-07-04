#!/usr/bin/env node

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Cargar env ──────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    console.error("ERROR: No se encuentra .env.local en la raíz del proyecto");
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
  auth: { autoRefreshToken: true, persistSession: false },
});

async function authedSupabase() {
  // Sign in with admin credentials to bypass RLS
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@almaia.com",
    password: "Admin123!",
  });
  if (error) {
    console.warn("⚠️  No se pudo autenticar en Supabase. Intentando con anon key...");
  } else {
    console.log("✅ Autenticado en Supabase como admin");
  }
  return supabase;
}

// ── Estado del sync ─────────────────────────────────────────
const stats = { updated: 0, inserted: 0, archived: 0, errors: 0, skipped: 0 };
let debugDumped = false;

// ── Limpiar texto ───────────────────────────────────────────
function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function parseNumber(text) {
  // Detecta formato: inglés (1,225.00) o español (1.225,00)
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  if (hasDot && hasComma) {
    // El último separador determina el decimal
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastDot > lastComma) {
      // Formato inglés: 1,225.00 → quitar comas, punto es decimal
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    } else {
      // Formato español: 1.225,00 → quitar puntos, coma es decimal
      return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    }
  } else if (hasComma) {
    // Solo comas: si hay 3+ dígitos antes de la última coma, es miles (inglés sin decimal)
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Probable decimal: 1225,50 → reemplazar coma por punto
      return parseFloat(cleaned.replace(",", ".")) || 0;
    }
    // Miles: 1,225 → quitar comas
    return parseFloat(cleaned.replace(/,/g, "")) || 0;
  } else if (hasDot) {
    // Solo puntos: si hay 3+ dígitos después del último punto, es decimal inglés
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    if (last.length <= 2 && parts.length > 1) {
      // Decimal: 1225.50
      return parseFloat(cleaned) || 0;
    }
    // Miles o código: 1.225 → quitar puntos
    return parseFloat(cleaned.replace(/\./g, "")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function extractPV(text) {
  if (!text) return 0;
  const patterns = [
    /PV\/BV[:\s]*([\d.]+)\s*\//i,
    /PV\/BV\n([\d.]+)/i,
    /PV[:\s]*([\d.]+)/i,
    /BV[:\s]*([\d.]+)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return parseNumber(m[1]);
  }
  return 0;
}

function extractPrice(text) {
  if (!text) return 0;
  return parseNumber(text);
}

// ── Esperar login manual ────────────────────────────────────
async function waitForLogin(page) {
  console.log("\n📌 Se abrirá una ventana de Chrome.");
  console.log("👉 Inicia sesión en Amway con tu cuenta de IBO.");
  console.log("👉 Cuando hayas iniciado sesión, presiona Enter aquí para continuar.\n");
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });
  console.log("⏳ Continuando...\n");
}

// ── Navegar categorías ──────────────────────────────────────
async function getCategories(page) {
  console.log("🔍 Buscando categorías...");
  // Intentar varios selectores comunes de navegación
  const selectors = [
    "nav a[href*='/es_DO/']",
    ".header-nav a",
    ".nav-link",
    "a[data-testid*='category']",
    ".main-navigation a",
    "header a[href*='/category']",
    ".navbar-nav a",
    "[class*='category'] a",
  ];

  let categories = [];
  for (const sel of selectors) {
    const links = await page.$$(sel);
    for (const link of links) {
      const href = await link.getAttribute("href");
      const text = cleanText(await link.textContent());
      if (href && text && href !== "#" && !href.startsWith("javascript")) {
        const fullUrl = href.startsWith("http") ? href : `https://www.amway.com.do${href.startsWith("/") ? "" : "/"}${href}`;
        if (!categories.find((c) => c.url === fullUrl)) {
          categories.push({ name: text, url: fullUrl });
        }
      }
    }
    if (categories.length > 0) break;
  }

  // Si no se encontraron categorías, buscar enlaces de productos en la página principal
  if (categories.length === 0) {
    console.log("⚠️  No se encontraron categorías en la navegación. Buscando enlaces de productos...");
    const allLinks = await page.$$("a[href]");
    for (const link of allLinks) {
      const href = await link.getAttribute("href");
      if (href && (href.includes("/product/") || href.includes("/p/") || href.includes("/item/"))) {
        const text = cleanText(await link.textContent());
        if (text) {
          const fullUrl = href.startsWith("http") ? href : `https://www.amway.com.do${href}`;
          if (!categories.find((c) => c.url === fullUrl)) {
            categories.push({ name: text, url: fullUrl });
          }
        }
      }
    }
  }

  console.log(`✅ Se encontraron ${categories.length} categorías/enlaces`);
  return categories;
}

// ── Obtener productos de una categoría ──────────────────────
async function getProductsFromCategory(page, category) {
  console.log(`\n📂 Categoría: ${category.name}`);
  const products = [];

  try {
    await page.goto(category.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll down to load more products (infinite scroll / lazy load)
    let prevHeight = 0;
    for (let i = 0; i < 5; i++) {
      prevHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === prevHeight) break;
    }

    // Buscar enlaces de productos en la página
    const productLinkSelectors = [
      "a[href*='-p-']",
      "a[href*='/product/']",
      "a[href*='/p/']",
      "a[href*='/item/']",
      "a[class*='product']",
      "[class*='product'] a",
      "[class*='ProductCard'] a",
      ".product-item a",
      ".grid a[href]",
    ];

    let productLinks = [];
    for (const sel of productLinkSelectors) {
      productLinks = await page.$$(sel);
      if (productLinks.length > 0) break;
    }

    // Extraer URLs únicas
    const urls = new Set();
    for (const link of productLinks) {
      const href = await link.getAttribute("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
        const fullUrl = href.startsWith("http") ? href : `https://www.amway.com.do${href.startsWith("/") ? "" : "/"}${href}`;
        urls.add(fullUrl);
      }
    }

    console.log(`   ${urls.size} productos encontrados`);

    for (const url of urls) {
      try {
        const product = await scrapeProduct(page, url);
        if (product) products.push(product);
      } catch (err) {
        console.error(`   ⚠️  Error en ${url}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️  Error en categoría ${category.name}: ${err.message}`);
  }

  return products;
}

// ── Scrapear producto individual ────────────────────────────
async function scrapeProduct(page, url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);

    // 1) Click en tabs/acordeones de forma segura
    const originalUrl = page.url();
    const tabKeywords = ["detalles", "ingredientes", "preguntas", "instrucciones", "uso", "detail", "faq"];
    try {
      const clickableEls = await page.$$("button, [role='tab'], summary, [class*='accordion'] > div > div:first-child, [class*='AccordionItem'] > button");
      for (const el of clickableEls) {
        try {
          const text = ((await el.textContent()) || "").toLowerCase().trim();
          if (tabKeywords.some(kw => text.includes(kw)) && text.length < 60) {
            await el.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);
            // Si navegó, volver
            if (page.url() !== originalUrl) {
              await page.goBack({ timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(1000);
              break;
            }
          }
        } catch { /* ignorar */ }
      }
    } catch { /* ignorar */ }
    await page.waitForTimeout(500);

    // 2) Extraer datos del DOM
    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split("\n").map(l => l.trim()).filter(Boolean);

      const h1 = document.querySelector("h1");
      const name = h1 ? h1.textContent.trim() : "";

      let code = "";
      let quantity = "";
      const codeLine = lines.find(l => /(?:Artículo|Art\.|Item|N°|No\.|SKU|Código)\s*[#:]?\s*\w+/i.test(l));
      if (codeLine) {
        for (const p of codeLine.split(/\s+/)) {
          const clean = p.replace(/[#:,\s]/g, "");
          if (/^\d{4,}[A-Za-z]{0,3}$/.test(clean)) { code = clean; break; }
        }
        const qtyMatch = codeLine.match(/(\d+\s*(?:tabletas?|cápsulas?|sobres?|unidades?|piezas?|tabs?|sachets?|gr|g|ml|l|kg|oz))/i);
        if (qtyMatch) quantity = qtyMatch[1].trim();
      }

      let costLine = "";
      const costIdx = lines.findIndex(l => /Costo\s*al?\s*IBO|Precio\s*IBO/i.test(l));
      if (costIdx >= 0) costLine = lines[costIdx] + " " + (lines[costIdx + 1] || "");
      else costLine = lines.find(l => /\$\s*[\d,.]+/.test(l)) || "";

      let pvLine = "";
      // Buscar "PV/BV" y tomar la siguiente línea (multi-line)
      for (let i = 0; i < lines.length; i++) {
        if (/PV\/BV/i.test(lines[i])) {
          const nextLine = lines[i + 1] || "";
          pvLine = lines[i] + " " + nextLine;
          break;
        }
      }
      // Fallback: buscar en bodyText completo
      if (!pvLine) {
        for (const pat of [/PV\/BV[:\s]*[\d.]+/i, /PV[:\s]+[\d.]+/i, /\bPV\b.*\d+/i]) {
          const m = bodyText.match(pat);
          if (m) { pvLine = m[0]; break; }
        }
      }

      let brand = "";
      let subbrand = "";
      const breadcrumb = document.querySelector("[class*='breadcrumb'], nav[aria-label*='breadcrumb']");
      if (breadcrumb) {
        const bcParts = (breadcrumb.textContent || "").split(/[\/>]/).map(s => s.trim()).filter(Boolean);
        if (bcParts.length >= 2) brand = bcParts[1];
        if (bcParts.length >= 3) subbrand = bcParts[2];
      }
      if (!brand) {
        const meta = document.querySelector("meta[property='product:brand'], meta[name='brand']");
        if (meta) brand = meta.getAttribute("content") || "";
      }

      let certText = "";
      document.querySelectorAll("[class*='certif'], [class*='badge'], [class*='seal'], [class*='logo']").forEach(el => {
        const t = (el.textContent || "").trim();
        if (t.length > 20 && t.length < 500) certText += t + " | ";
      });

      // Extraer contenido de tabs por posición en lines[]
      const tabContent = {};
      const tabMap = {
        "detalles del producto": "detalles",
        "detalles": "detalles",
        "ingredientes": "ingredientes",
        "instrucciones de uso": "instrucciones",
        "instrucciones": "instrucciones",
      };
      const tabHeadings = [];
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase().trim();
        for (const [key, label] of Object.entries(tabMap)) {
          if (lower === key || lower.startsWith(key + "\t") || lower.startsWith(key + " ")) {
            tabHeadings.push({ idx: i, label });
            break;
          }
        }
      }
      // Extraer contenido entre headings
      for (let t = 0; t < tabHeadings.length; t++) {
        const start = tabHeadings[t].idx + 1;
        const end = t + 1 < tabHeadings.length ? tabHeadings[t + 1].idx : start + 50;
        const content = lines.slice(start, end).filter(l => l.length > 0 && !/Preguntas frecuentes|Instrucciones de uso|Detalles del Producto|Ingredientes|Recursos/i.test(l)).join("\n").trim();
        if (content.length > 5) tabContent[tabHeadings[t].label] = content.substring(0, 3000);
      }

      const longParagraphs = lines.filter(l => l.length > 40 && !/^\$|RD\$|carrito|comprar|envío|impuesto|Costo\s*al?\s*IBO|PV\/BV|Artículo/i.test(l)).slice(0, 15);

      return { name, code, quantity, costLine, pvLine, brand, subbrand, certText, tabContent, longParagraphs, bodyText };
    });

    if (!data.name && !data.code) return null;

    const cost = extractPrice(data.costLine);
    let pv = extractPV(data.pvLine);
    // Fallback: buscar PV en todo el texto combinado
    if (pv === 0) {
      const allText = Object.values(data.tabContent || {}).join("\n") + "\n" + (data.longParagraphs || []).join("\n") + "\n" + (data.bodyText || "");
      pv = extractPV(allText);
    }
    console.log(`   📦 ${data.name} | Código: ${data.code} | PV: ${pv} (raw: "${data.pvLine?.substring(0, 50) || ""}") | Costo: ${cost}`);

    // Construir descripción
    let description = `Artículo N°: ${data.code || "N/A"}`;
    if (data.quantity) description += ` | Contenido: ${data.quantity}`;
    description += "\n\n";
    if (data.certText) description += `Certificaciones: ${data.certText}\n\n`;

    const tabLabels = { detalles: "Detalles del Producto", ingredientes: "Ingredientes", preguntas: "Preguntas Frecuentes", instrucciones: "Instrucciones de Uso" };
    for (const [key, label] of Object.entries(tabLabels)) {
      if (data.tabContent[key]) description += `[${label}]\n${data.tabContent[key]}\n\n`;
    }
    if (data.longParagraphs.length > 0) description += `[Información adicional]\n${data.longParagraphs.join("\n")}\n`;

    // Imagen
    let imageUrl = "";
    const metaOg = await page.$("meta[property='og:image']");
    if (metaOg) imageUrl = await metaOg.getAttribute("content") || "";
    if (!imageUrl) {
      const imgEl = await page.$("img[class*='product'], .product-image img, [class*='gallery'] img");
      if (imgEl) imageUrl = await imgEl.getAttribute("src") || "";
    }

    return {
      code: data.code, name: data.name, cost, pv,
      price_30: cost > 0 ? Math.round(cost * 1.30 * 100) / 100 : 0,
      price_35: cost > 0 ? Math.round(cost * 1.35 * 100) / 100 : 0,
      description: description.trim(), benefits: description.trim(),
      image_url: imageUrl, active: true, apply_itbis: true,
      subbrand: data.subbrand || data.brand || "",
    };
  } catch (err) {
      if (attempt < retries) {
        console.log(`   ⏳ Reintentando (${attempt}/${retries})... ${err.message.substring(0, 60)}`);
        await page.waitForTimeout(3000);
        continue;
      }
      console.error(`   ⚠️  Error scraping ${url}: ${err.message}`);
      return null;
    }
  }
  return null;
}

// ── Extraer código de producto ──────────────────────────────
// ── Sincronizar con Supabase ────────────────────────────────
async function syncToSupabase(scrapedProducts) {
  console.log("\n📡 Sincronizando con Supabase...");

  const db = await authedSupabase();

  // Obtener subbrands existentes
  const { data: existingSubbrands } = await db.from("subbrands").select("id, name");
  const subbrandsByName = {};
  for (const sb of existingSubbrands || []) {
    subbrandsByName[sb.name.toLowerCase().trim()] = sb.id;
  }

  // Obtener productos existentes
  const { data: existing, error } = await db
    .from("products")
    .select("id, code, name, active");

  if (error) {
    console.error("ERROR al leer productos existentes:", error.message);
    return;
  }

  const existingByCode = {};
  for (const p of existing || []) {
    if (p.code) existingByCode[p.code] = p;
  }

  const scrapedCodes = new Set();
  const validProducts = scrapedProducts.filter((p) => p.code);

  for (const product of validProducts) {
    scrapedCodes.add(product.code);
    try {
      // Resolver subbrand_id
      let subbrand_id = null;
      if (product.subbrand) {
        const sbName = product.subbrand.toLowerCase().trim();
        if (subbrandsByName[sbName]) {
          subbrand_id = subbrandsByName[sbName];
        } else {
          // Crear subbrand nueva
          const { data: newSb } = await db.from("subbrands").insert({ name: product.subbrand }).select().single();
          if (newSb) {
            subbrandsByName[sbName] = newSb.id;
            subbrand_id = newSb.id;
            console.log(`   🏷️  Submarca creada: ${product.subbrand}`);
          }
        }
      }

      const existingProduct = existingByCode[product.code];

      if (existingProduct) {
        // Actualizar
        const updateData = {
          name: product.name,
          cost: product.cost,
          pv: product.pv,
          price_30: product.price_30,
          price_35: product.price_35,
          description: product.description,
          benefits: product.benefits,
          image_url: product.image_url || existingProduct.image_url,
          active: true,
        };
        if (subbrand_id) updateData.subbrand_id = subbrand_id;

        const { error: updErr } = await db
          .from("products")
          .update(updateData)
          .eq("id", existingProduct.id);

        if (updErr) throw updErr;
        stats.updated++;
        console.log(`   ✅ Actualizado: ${product.name || product.code}`);
      } else {
        // Insertar nuevo
        const insertData = {
          code: product.code,
          name: product.name || "Sin nombre",
          cost: product.cost || 0,
          pv: product.pv || 0,
          price_30: product.price_30 || 0,
          price_35: product.price_35 || 0,
          description: product.description || "",
          benefits: product.benefits || "",
          image_url: product.image_url || "",
          active: true,
          apply_itbis: true,
        };
        if (subbrand_id) insertData.subbrand_id = subbrand_id;

        const { error: insErr } = await db.from("products").insert(insertData);

        if (insErr) throw insErr;
        stats.inserted++;
        console.log(`   🆕 Insertado: ${product.name || product.code}`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`   ❌ Error con ${product.code}: ${err.message}`);
    }
  }

  // Archivar productos que ya no están en Amway RD
  for (const p of existing || []) {
    if (p.code && !scrapedCodes.has(p.code) && p.active) {
      try {
        const { error: archErr } = await supabase
          .from("products")
          .update({ active: false })
          .eq("id", p.id);

        if (archErr) throw archErr;
        stats.archived++;
        console.log(`   📦 Archivado: ${p.name || p.code} (ya no está en Amway RD)`);
      } catch (err) {
        stats.errors++;
        console.error(`   ❌ Error al archivar ${p.code}: ${err.message}`);
      }
    } else if (p.code && scrapedCodes.has(p.code) && !p.active) {
      // Reactivar si estaba archivado pero vuelve a estar disponible
      await db.from("products").update({ active: true }).eq("id", p.id);
    }
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Sincronizador de Catálogo Amway RD     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const userDataDir = resolve(__dirname, "..", ".amway-profile");

  // Limpiar locks de Chrome si existen
  console.log("🧹 Limpiando locks de Chrome...");
  const { unlinkSync, mkdirSync } = await import("fs");
  try { mkdirSync(userDataDir, { recursive: true }); } catch {}
  for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try { unlinkSync(resolve(userDataDir, f)); } catch {}
  }
  console.log("✅ Locks limpiados");

  console.log("🚀 Abriendo navegador...");
  let browser;
  try {
    // Intentar con Chrome real
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
      viewport: null,
      locale: "es-DO",
      ignoreHTTPSErrors: true,
    });
    console.log("✅ Chrome real abierto");
  } catch (err) {
    console.log(`⚠️  Chrome real falló: ${err.message}`);
    console.log("🔄 Intentando con Chromium de Playwright...");
    try {
      browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
        viewport: null,
        locale: "es-DO",
        ignoreHTTPSErrors: true,
      });
      console.log("✅ Chromium abierto");
    } catch (err2) {
      console.error(`❌ No se pudo abrir navegador: ${err2.message}`);
      process.exit(1);
    }
  }

  console.log("📄 Obteniendo página...");
  const pages = browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  console.log("✅ Página lista");

  // Evitar detección de bot
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["es-DO", "es", "en"] });
  });

  console.log("⏳ Cargando Amway... (puede tardar hasta 60 segundos)");
  try {
    await page.goto("https://www.amway.com.do/es_DO", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    console.log("✅ Página cargada");
  } catch (err) {
    console.log(`⚠️  La página tardó en cargar: ${err.message}. Continuando...`);
  }

  await page.waitForTimeout(2000);

  // Esperar login manual
  await waitForLogin(page);

  // Preguntar marcas/categorías a scrapear
  console.log("\n🔍 ¿Qué marcas/categorías quieres sincronizar?");
  console.log("   Ej: Nutrilite, Artistry, XS, Glister, iCook, SATINIQUE, etc.");
  console.log("   (Sepáralas por coma. Ej: Nutrilite, Artistry, XS)");
  process.stdout.write("👉 Marcas: ");

  const brandsInput = await new Promise((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });
  const brands = brandsInput ? brandsInput.split(",").map((b) => b.trim()).filter(Boolean) : [];

  const allProducts = [];

  if (brands.length === 0) {
    console.log("⚠️  No ingresaste marcas. Usando la URL actual como página de productos.");
    console.log("📌 Presiona Enter cuando estés en la página con la lista de productos.");
    await new Promise((resolve) => { process.stdin.once("data", resolve); });
    const currentUrl = page.url();

    const products = await getProductsFromCategory(page, { name: "Productos", url: currentUrl });
    allProducts.push(...products);
  } else {
    console.log(`\n🔎 Buscando productos de: ${brands.join(", ")}`);

    for (const brand of brands) {
      console.log(`\n📂 ${brand}`);
      const searchUrl = `https://www.amway.com.do/es_DO/search/?text=${encodeURIComponent(brand)}`;
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(3000);

        // Scroll para cargar más productos
        for (let i = 0; i < 8; i++) {
          const prevCount = (await page.$$("a[href*='-p-']")).length;
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(2000);
          const newCount = (await page.$$("a[href*='-p-']")).length;
          if (newCount === prevCount && i > 2) break;
        }

        const productLinks = await page.$$("a[href*='-p-']");
        const urls = new Set();
        for (const link of productLinks) {
          const href = await link.getAttribute("href");
          if (href && href.includes("-p-")) {
            const fullUrl = href.startsWith("http") ? href : `https://www.amway.com.do${href.startsWith("/") ? "" : "/"}${href}`;
            urls.add(fullUrl);
          }
        }

        console.log(`   ${urls.size} productos encontrados`);

        let count = 0;
        for (const url of urls) {
          try {
            const product = await scrapeProduct(page, url);
            if (product) allProducts.push(product);
            count++;
            if (count % 10 === 0) console.log(`   Progreso: ${count}/${urls.size}`);
          } catch (err) {
            console.error(`   ⚠️  Error: ${err.message}`);
          }
        }
      } catch (err) {
        console.error(`   ⚠️  Error buscando ${brand}: ${err.message}`);
      }
    }

    if (allProducts.length > 0) {
      console.log(`\n📊 Total de productos scrapeados: ${allProducts.length}`);
      await syncToSupabase(allProducts);
    } else {
      console.log("\n⚠️  No se encontraron productos.");
    }
  }

  // Resumen final
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║           RESUMEN DE SINCRONIZACIÓN     ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Actualizados:  ${stats.updated.toString().padStart(4)} productos`);
  console.log(`║  Insertados:    ${stats.inserted.toString().padStart(4)} productos`);
  console.log(`║  Archivados:    ${stats.archived.toString().padStart(4)} productos`);
  console.log(`║  Errores:       ${stats.errors.toString().padStart(4)}`);
  console.log("╚══════════════════════════════════════════╝\n");

  await browser.close();
}

main().catch((err) => {
  console.error("ERROR FATAL:", err.message || err);
  process.exit(1);
});
