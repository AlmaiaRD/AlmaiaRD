/**
 * MIGRADOR DE IMÁGENES DE PRODUCTOS (amway.com.do -> Supabase Storage)
 * ------------------------------------------------------------------
 * Este script DEBE ejecutarse en UNA COMPUTADORA PERSONAL (la tuya), NO en
 * el servidor. Amway bloquea a los servidores, pero SÍ sirve las imágenes a
 * tu computadora. El script abre cada imagen en un navegador, captura los
 * bytes (esto NO necesita permiso CORS), la sube a Supabase Storage y
 * actualiza el producto.
 *
 * Uso:
 *   1) Abre una terminal en la carpeta del proyecto (donde está este archivo)
 *   2) Ejecuta:   node scripts/migrate-images.mjs
 *
 * Requisitos: Node.js instalado y haber ejecutado `npm install` una vez.
 * Usa las credenciales de .env.local (URL, anon key, admin).
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env.local"));

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = env.ADMIN_EMAIL || "admin@almaia.com";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON || !ADMIN_PASSWORD) {
  console.error("Faltan variables en .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_PASSWORD).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const resultsFile = path.join(__dirname, "migrate-images-results.txt");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1) Autenticarse como admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authErr) {
    console.error("Error de autenticación:", authErr.message);
    process.exit(1);
  }
  console.log("Sesión admin iniciada:", auth.user?.email);

  // 2) Consultar productos con imagen de amway
  const { data: products, error: qErr } = await supabase
    .from("products")
    .select("id, code, name, image_url")
    .ilike("image_url", "%amway.com.do%");

  if (qErr) {
    console.error("Error al consultar productos:", qErr.message);
    process.exit(1);
  }
  console.log(`Productos con imagen de amway: ${products.length}`);

  fs.writeFileSync(resultsFile, "", "utf8");

  const browser = await chromium.launch();

  let okCount = 0;
  let errCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const label = `[${i + 1}/${products.length}] ${p.code} - ${p.name}`;
    process.stdout.write(`\n${label} ... `);

    // Re-verificar: si ya no apunta a amway, se salta
    if (!p.image_url || !p.image_url.includes("amway.com.do")) {
      console.log("omitido (ya migrado)");
      fs.appendFileSync(resultsFile, `${p.code}\tSKIP\t${p.name}\n`);
      continue;
    }

    try {
      const bytes = await captureImage(browser, p.image_url);
      if (!bytes) {
        throw new Error("No se obtuvo la imagen");
      }

      // 3) Subir a Storage
      const ext = extFor(bytes);
      const fileName = `${p.code}_${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(fileName, bytes, { upsert: true, contentType: mimeFor(ext) });
      if (upErr) throw new Error("Subida: " + upErr.message);

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      // 4) Actualizar producto
      const { error: updErr } = await supabase
        .from("products")
        .update({ image_url: publicUrl })
        .eq("id", p.id);
      if (updErr) throw new Error("Actualizar: " + updErr.message);

      okCount++;
      console.log("OK -> " + publicUrl);
      fs.appendFileSync(resultsFile, `${p.code}\tOK\t${publicUrl}\n`);
    } catch (e) {
      errCount++;
      const msg = (e && e.message) || String(e);
      console.log("ERROR: " + msg);
      fs.appendFileSync(resultsFile, `${p.code}\tERROR\t${p.name}\t${msg}\n`);
    }
  }

  await browser.close();

  console.log("\n\n===== RESUMEN =====");
  console.log(`Totales: ${products.length} | OK: ${okCount} | ERROR: ${errCount}`);
  console.log(`Detalle en: ${resultsFile}`);
}

async function captureImage(browser, url) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await context.newPage();

  let captured = null;
  page.on("response", async (res) => {
    try {
      const rurl = res.url();
      if (rurl.includes("amway") && res.status() === 200) {
        const contentType = res.headers()["content-type"] || "";
        if (contentType.startsWith("image/")) {
          const buf = await res.body().catch(() => null);
          if (buf && buf.length > 1000 && !captured) captured = buf;
        }
      }
    } catch { /* ignore */ }
  });

  try {
    await page.goto(url, { waitUntil: "load", timeout: 45000 }, );
    // Esperar hasta que se capture la imagen (máx. 20s)
    for (let t = 0; t < 40 && !captured; t++) {
      await delay(500);
    }
  } catch { /* goto puede fallar; aún así esperamos la captura */ }

  await context.close();
  return captured;
}

function extFor(bytes) {
  const sig = bytes.slice(0, 4).toString("hex");
  if (sig.startsWith("ffd8")) return "jpg";
  if (sig.startsWith("89504e47")) return "png";
  if (sig.startsWith("52494646")) return "webp";
  if (sig.startsWith("474946")) return "gif";
  return "jpg";
}

function mimeFor(ext) {
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext] || "image/jpeg";
}

main().catch((e) => {
  console.error("\nError general:", e);
  process.exit(1);
});
