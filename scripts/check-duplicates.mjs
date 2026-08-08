#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

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
  email: "admin@almaia.com",
  password: "Admin123!",
});
if (authError) {
  console.error("ERROR autenticación:", authError.message);
  process.exit(1);
}
console.log("✅ Autenticado como admin");

const { data: products, error } = await supabase
  .from("products")
  .select("id, code, name, active, cost, pv, created_at");
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

const active = (products || []).filter(p => p.active);
console.log(`\nTotal activos: ${active.length}`);

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

// Duplicados por nombre normalizado
const byName = {};
for (const p of active) {
  const key = normalizeName(p.name);
  if (!key) continue;
  if (!byName[key]) byName[key] = [];
  byName[key].push(p);
}

let nameDuplicates = 0;
console.log("\n=== DUPLICADOS POR NOMBRE (activos) ===");
for (const key of Object.keys(byName)) {
  if (byName[key].length > 1) {
    nameDuplicates++;
    console.log(`\n"${key}" (${byName[key].length}):`);
    for (const p of byName[key]) {
      console.log(`   id=${p.id} code=${p.code} cost=${p.cost} pv=${p.pv} created=${p.created_at}`);
    }
  }
}
console.log(`\nTotal duplicados por nombre: ${nameDuplicates}`);

// Duplicados por código base (ej. 109741CO vs 109741)
const byBaseCode = {};
for (const p of active) {
  const m = (p.code || "").match(/^(\d{4,6})/);
  if (!m) continue;
  const base = m[1];
  if (!byBaseCode[base]) byBaseCode[base] = [];
  byBaseCode[base].push(p);
}
let codeDuplicates = 0;
console.log("\n=== DUPLICADOS POR CÓDIGO BASE (activos) ===");
for (const base of Object.keys(byBaseCode)) {
  if (byBaseCode[base].length > 1) {
    codeDuplicates++;
    console.log(`\nBase ${base} (${byBaseCode[base].length}):`);
    for (const p of byBaseCode[base]) {
      console.log(`   id=${p.id} code=${p.code} name="${p.name}" cost=${p.cost} pv=${p.pv}`);
    }
  }
}
console.log(`\nTotal duplicados por código base: ${codeDuplicates}`);
