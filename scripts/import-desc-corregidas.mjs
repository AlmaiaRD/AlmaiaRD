#!/usr/bin/env node
// Importa las descripciones y beneficios corregidos desde el CSV aprobado
// hacia la tabla `products`, haciendo match por `code`.
// IMPORTANTE: SOLO actualiza las columnas `description` y `benefits`.
// NO toca `pv`, precios, costos, itbis ni ningun otro campo.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { adminCredentials } from "./_auth.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
const creds = adminCredentials();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Ruta del CSV corregido
const CSV_PATH = process.env.CSV_PATH || "C:/Users/soporte/Downloads/inventario-descripciones-corregido.csv";

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
      else if (c === ";") { row.push(field); field = ""; }
      else field += c;
    }
  }
  // ultimo campo/linea sin salto final
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const text = readFileSync(CSV_PATH, "utf-8");
const rows = parseCsv(text);
if (rows.length < 2) { console.error("CSV vacio o sin datos"); process.exit(1); }
const header = rows[0].map((h) => h.trim());
const idxNombre = header.indexOf("Nombre");
const idxCodigo = header.indexOf("Código");
const idxDesc = header.indexOf("Descripción");
const idxBen = header.indexOf("Beneficios");
if (idxCodigo === -1 || idxDesc === -1 || idxBen === -1) {
  console.error("El CSV no tiene las columnas esperadas:", header);
  process.exit(1);
}

const dataRows = rows.slice(1).filter((r) => r[idxCodigo] && r[idxCodigo].trim() !== "");

console.log("Filas en CSV (excl. header):", dataRows.length);

// Autenticar
const { error: ae } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
if (ae) { console.error("Auth error:", ae.message); process.exit(1); }

// Construir mapa codigo -> {description, benefits}
const updates = [];
const seen = new Set();
for (const r of dataRows) {
  const code = r[idxCodigo].trim();
  const description = (r[idxDesc] || "").trim();
  const benefits = (r[idxBen] || "").trim();
  if (seen.has(code)) continue;
  seen.add(code);
  updates.push({ code, description, benefits });
}

console.log("Productos a actualizar:", updates.length);

// Modo dry-run por defecto; usar APPLY=1 para escribir en la BD
const apply = process.env.APPLY === "1";

let matched = 0;
let notFound = [];
let pvChangedGuard = 0;

for (const u of updates) {
  // Buscar por code
  const { data: found, error: ferr } = await supabase
    .from("products")
    .select("id, code, pv")
    .eq("code", u.code);
  if (ferr) { console.error("Error consultando", u.code, ferr.message); continue; }
  if (!found || found.length === 0) { notFound.push(u.code); continue; }

  // Solo description + benefits. Si hay mas de un row con el mismo code, actualizar todos.
  if (apply) {
    const { error: uerr } = await supabase
      .from("products")
      .update({ description: u.description, benefits: u.benefits })
      .eq("code", u.code);
    if (uerr) { console.error("Error updating", u.code, "->", uerr.message); continue; }
  }
  matched += found.length;
  for (const f of found) { if (String(f.pv) !== String(0)) pvChangedGuard++; }
}

console.log("\n=== Resultado ===");
console.log("Coincidencias (filas de producto a actualizar):", matched);
console.log("Codigos no encontrados en BD:", notFound.length, notFound.join(", ") || "(ninguno)");
console.log("Filas con pv != 0 (referencia, no se tocan):", pvChangedGuard);
console.log("Aplicado a la BD (APPLY=1):", apply ? "SI" : "NO (dry-run)");
