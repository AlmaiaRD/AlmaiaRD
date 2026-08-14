#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
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

const { error: authError } = await supabase.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
});
if (authError) {
  console.error("ERROR autenticación:", authError.message);
  process.exit(1);
}
console.log("✅ Autenticado como admin");

const { data, error } = await supabase
  .from("products")
  .select("id, code, name, active");

if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

const products = data || [];
const byCode = {};
for (const p of products) {
  if (!p.code) continue;
  if (!byCode[p.code]) byCode[p.code] = [];
  byCode[p.code].push(p);
}

const duplicates = [];
for (const code of Object.keys(byCode)) {
  const list = byCode[code];
  const active = list.filter((p) => p.active);
  const inactive = list.filter((p) => !p.active);
  if (inactive.length > 0 && active.length > 0) {
    duplicates.push({ code, active, inactive });
  }
}

const archived = products.filter((p) => !p.active && p.code);

console.log("=== RESUMEN ===");
console.log(`Total productos: ${products.length}`);
console.log(`Productos activos: ${products.filter((p) => p.active).length}`);
console.log(`Productos archivados: ${archived.length}`);
console.log(`Códigos con duplicado (activo + archivado): ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log("=== DUPLICADOS (archivado con mismo código que uno activo) ===");
  for (const d of duplicates) {
    const activeNames = d.active.map((p) => `${p.name} (${p.id.slice(0, 8)})`).join(", ");
    const inactiveNames = d.inactive.map((p) => `[ARCHIVADO] ${p.name} (${p.id.slice(0, 8)})`).join(", ");
    console.log(`Código ${d.code}:`);
    console.log(`   Activo: ${activeNames}`);
    console.log(`   Archivado: ${inactiveNames}`);
  }
}

console.log("");
console.log("=== DUPLICADOS POR NOMBRE (mismo nombre, uno activo y otro archivado) ===");
function normalizeName(n) {
  return (n || "").toLowerCase().replace(/[™®]/g, "").replace(/\s+/g, " ").trim();
}
const byName = {};
for (const p of products) {
  const key = normalizeName(p.name);
  if (!key) continue;
  if (!byName[key]) byName[key] = [];
  byName[key].push(p);
}
let nameDuplicates = 0;
for (const key of Object.keys(byName)) {
  const list = byName[key];
  const active = list.filter((p) => p.active);
  const inactive = list.filter((p) => !p.active);
  if (inactive.length > 0 && active.length > 0) {
    nameDuplicates++;
    const activeIds = active.map((p) => `${p.code} (${p.id.slice(0, 8)})`).join(", ");
    const inactiveIds = inactive.map((p) => `[ARCHIVADO] ${p.code} (${p.id.slice(0, 8)})`).join(", ");
    console.log(`"${key}":`);
    console.log(`   Activo: ${activeIds}`);
    console.log(`   Archivado: ${inactiveIds}`);
  }
}
console.log(`Total duplicados por nombre: ${nameDuplicates}`);

console.log("");
console.log("=== PRODUCTOS ARCHIVADOS (" + archived.length + ") ===");
for (const p of archived.sort((a, b) => (a.code || "").localeCompare(b.code || ""))) {
  console.log((p.code || "") + "\t" + p.name);
}
