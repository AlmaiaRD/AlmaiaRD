#!/usr/bin/env node

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
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

const stats = { reactivated: 0, updated: 0, not_found: 0, errors: 0 };

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function normalizeName(n) {
  return (n || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9áéíóúñü ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.,]/g, "");
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

// Extrae el código base de un href de Amway (ej: ...p-109741CO → 109741)
function extractCodeFromHref(href) {
  const m = href.match(/-p-([0-9A-Za-z]+)$/);
  if (!m) return "";
  const code = m[1];
  const baseMatch = code.match(/^(\d{4,6})/);
  return baseMatch ? baseMatch[1] : code;
}

async function waitForLogin(page, timeoutMs = 600000) {
  console.log("\n📌 Se abrió Chrome con tu perfil guardado.");
  console.log("👉 Si ya iniciaste sesión, no hagas nada. Si no, inicia sesión ahora.");
  console.log("⏳ Esperando login (máx 10 min)...\n");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const hasSession = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText : "";
        return /Hola,|Cerrar sesi[oó]n|Mi cuenta|Sign out|Salir|Logout/i.test(txt);
      });
      if (hasSession) {
        console.log("✅ Login detectado. Continuando...\n");
        return true;
      }
    } catch { /* transición */ }
    await page.waitForTimeout(3000);
  }
  console.log("⏰ Tiempo de espera agotado. Revisa la sesión.");
  return false;
}

// Busca el producto por nombre en Amway RD y devuelve la URL del que mejor coincide
async function searchProductOnAmway(page, archived) {
  const query = encodeURIComponent(archived.searchName || archived.name);
  const searchUrl = `https://www.amway.com.do/es_DO/search/?text=${query}`;
  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
  } catch (err) {
    console.log(`   ⚠️  Error cargando búsqueda para ${archived.code}: ${err.message}`);
    return null;
  }

  const links = await page.$$("a[href*='-p-']");
  let best = null;
  let bestScore = -1;

  for (const link of links) {
    const href = await link.getAttribute("href");
    const text = normalizeName(await link.textContent());
    if (!href) continue;

    const hrefCode = extractCodeFromHref(href);
    const fullUrl = href.startsWith("http") ? href : `https://www.amway.com.do${href.startsWith("/") ? "" : "/"}${href}`;

    let score = 0;
    if (hrefCode && hrefCode === archived.code) score += 100;
    else if (hrefCode && archived.code.startsWith(hrefCode)) score += 60;
    else if (hrefCode && hrefCode.startsWith(archived.code)) score += 60;

    const targetNorm = normalizeName(archived.name);
    if (text && targetNorm) {
      if (text.includes(targetNorm) || targetNorm.includes(text)) score += 30;
      else {
        const tWords = targetNorm.split(" ").filter(w => w.length > 4);
        let matched = 0;
        for (const w of tWords) if (text.includes(w)) matched++;
        score += (matched / Math.max(1, tWords.length)) * 30;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = fullUrl;
    }
  }

  if (bestScore >= 40) return best;
  return null;
}

async function scrapeProductPage(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

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
          const c = p.replace(/[#:,\s]/g, "");
          if (/^\d{4,}[A-Za-z]{0,3}$/.test(c)) { code = c; break; }
        }
        const qtyMatch = codeLine.match(/(\d+\s*(?:tabletas?|cápsulas?|sobres?|unidades?|piezas?|tabs?|sachets?|gr|g|ml|l|kg|oz))/i);
        if (qtyMatch) quantity = qtyMatch[1].trim();
      }

      let costLine = "";
      const costIdx = lines.findIndex(l => /Costo\s*al?\s*IBO|Precio\s*IBO/i.test(l));
      if (costIdx >= 0) costLine = lines[costIdx] + " " + (lines[costIdx + 1] || "");
      else costLine = lines.find(l => /\$\s*[\d,.]+/.test(l)) || "";

      let pvLine = "";
      for (let i = 0; i < lines.length; i++) {
        if (/PV\/BV/i.test(lines[i])) {
          pvLine = lines[i] + " " + (lines[i + 1] || "");
          break;
        }
      }
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
      for (let t = 0; t < tabHeadings.length; t++) {
        const start = tabHeadings[t].idx + 1;
        const end = t + 1 < tabHeadings.length ? tabHeadings[t + 1].idx : start + 50;
        const content = lines.slice(start, end).filter(l => l.length > 0 && !/Preguntas frecuentes|Instrucciones de uso|Detalles del Producto|Ingredientes|Recursos/i.test(l)).join("\n").trim();
        if (content.length > 5) tabContent[tabHeadings[t].label] = content.substring(0, 3000);
      }

      const longParagraphs = lines.filter(l => l.length > 40 && !/^\$|RD\$|carrito|comprar|envío|impuesto|Costo\s*al?\s*IBO|PV\/BV|Artículo/i.test(l)).slice(0, 15);

      let certText = "";
      document.querySelectorAll("[class*='certif'], [class*='badge'], [class*='seal'], [class*='logo']").forEach(el => {
        const t = (el.textContent || "").trim();
        if (t.length > 20 && t.length < 500) certText += t + " | ";
      });

      return { name, code, quantity, costLine, pvLine, brand, subbrand, certText, tabContent, longParagraphs, bodyText };
    });

    if (!data.name && !data.code) return null;

    const cost = parseNumber(data.costLine);
    let pv = extractPV(data.pvLine);
    if (pv === 0) {
      const allText = Object.values(data.tabContent || {}).join("\n") + "\n" + (data.longParagraphs || []).join("\n") + "\n" + (data.bodyText || "");
      pv = extractPV(allText);
    }

    let description = `Artículo N°: ${data.code || "N/A"}`;
    if (data.quantity) description += ` | Contenido: ${data.quantity}`;
    description += "\n\n";
    if (data.certText) description += `Certificaciones: ${data.certText}\n\n`;

    const tabLabels = { detalles: "Detalles del Producto", ingredientes: "Ingredientes", preguntas: "Preguntas Frecuentes", instrucciones: "Instrucciones de Uso" };
    for (const [key, label] of Object.entries(tabLabels)) {
      if (data.tabContent[key]) description += `[${label}]\n${data.tabContent[key]}\n\n`;
    }
    if (data.longParagraphs.length > 0) description += `[Información adicional]\n${data.longParagraphs.join("\n")}\n`;

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
      image_url: imageUrl, subbrand: data.subbrand || data.brand || "",
    };
  } catch (err) {
    console.log(`   ⚠️  Error scrapeando ${url}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Verificar y reactivar archivados Amway  ║");
  console.log("╚══════════════════════════════════════════╝\n");

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
    .select("id, code, name, active, cost, pv, image_url, subbrand_id, price_30, price_35");
  if (prodErr) {
    console.error("ERROR leyendo productos:", prodErr.message);
    process.exit(1);
  }

  const archived = (products || [])
    .filter(p => !p.active && p.code && /^\d{4,6}$/.test(p.code))
    .map(p => ({ ...p, searchName: normalizeName(p.name) }));
  console.log(`📦 Productos archivados con código numérico: ${archived.length}\n`);

  const { data: existingSubbrands } = await supabase.from("subbrands").select("id, name");
  const subbrandsByName = {};
  for (const sb of existingSubbrands || []) {
    subbrandsByName[sb.name.toLowerCase().trim()] = sb.id;
  }

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

  await waitForLogin(page);

  for (const p of archived) {
    console.log(`\n🔍 Verificando: ${p.code} — ${p.name}`);
    try {
      const productUrl = await searchProductOnAmway(page, p);
      if (!productUrl) {
        stats.not_found++;
        console.log(`   ➖ No encontrado en Amway RD. Se mantiene archivado.`);
        continue;
      }

      const scraped = await scrapeProductPage(page, productUrl);
      if (!scraped || !scraped.name) {
        stats.not_found++;
        console.log(`   ➖ No se pudo leer la página del producto.`);
        continue;
      }

      console.log(`   📦 ${scraped.name} | PV: ${scraped.pv} | Costo: ${scraped.cost}`);

      let subbrand_id = p.subbrand_id || null;
      if (scraped.subbrand) {
        const sbName = scraped.subbrand.toLowerCase().trim();
        if (subbrandsByName[sbName]) {
          subbrand_id = subbrandsByName[sbName];
        } else {
          const { data: newSb } = await supabase.from("subbrands").insert({ name: scraped.subbrand }).select().single();
          if (newSb) {
            subbrandsByName[sbName] = newSb.id;
            subbrand_id = newSb.id;
          }
        }
      }

      const updateData = {
        name: scraped.name,
        cost: scraped.cost,
        pv: scraped.pv,
        price_30: scraped.price_30,
        price_35: scraped.price_35,
        description: scraped.description,
        benefits: scraped.benefits,
        image_url: scraped.image_url || p.image_url,
        active: true,
      };
      if (subbrand_id) updateData.subbrand_id = subbrand_id;

      const { error: updErr } = await supabase.from("products").update(updateData).eq("id", p.id);
      if (updErr) throw updErr;

      stats.reactivated++;
      console.log(`   ✅ Reactivado y actualizado: ${p.code}`);
    } catch (err) {
      stats.errors++;
      console.log(`   ❌ Error con ${p.code}: ${err.message}`);
    }
    await page.waitForTimeout(1500);
  }

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║              RESUMEN                    ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Reactivados/actualizados: ${stats.reactivated.toString().padStart(4)}`);
  console.log(`║  No encontrados:           ${stats.not_found.toString().padStart(4)}`);
  console.log(`║  Errores:                  ${stats.errors.toString().padStart(4)}`);
  console.log("╚══════════════════════════════════════════╝\n");

  await browser.close();
}

main().catch((err) => {
  console.error("ERROR FATAL:", err.message || err);
  process.exit(1);
});
