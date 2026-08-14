#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

import { adminCredentials } from "./_auth.mjs";
const creds = adminCredentials();
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXECUTE = process.argv.includes("--execute");

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
console.log("✅ Autenticado como admin\n");

const { data: products, error } = await supabase
  .from("products")
  .select("id, code, name, active, created_at, updated_at");
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

const active = (products || []).filter(p => p.active);

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

const byName = {};
for (const p of active) {
  const key = normalizeName(p.name);
  if (!key) continue;
  if (!byName[key]) byName[key] = [];
  byName[key].push(p);
}

// Pares excepcionales que NO se borran (Barra de Jabón g&h Protect)
const SKIP_NAMES = new Set(["barra de jabon g h protect"]);

// Códigos limpios que se conservan en pares ambiguos (110170, 109741, 127065)
const PREFER_CLEAN = new Set(["110170", "109741", "127065"]);

const pairs = [];
for (const key of Object.keys(byName)) {
  if (byName[key].length < 2) continue;
  if (SKIP_NAMES.has(key)) {
    console.log(`⏭️  SKIP (conservar ambos): "${key}"`);
    continue;
  }
  const list = byName[key];
  // Determinar cuál borrar
  let toDelete = null;
  let toKeep = null;
  const cleanOnes = list.filter(p => !/[A-Za-z]$/.test(p.code || "") && PREFER_CLEAN.has(p.code));
  const cleanMatches = list.filter(p => PREFER_CLEAN.has(p.code));
  if (cleanMatches.length === 1) {
    // Conservar el limpio, borrar los demás
    toKeep = cleanMatches[0];
    toDelete = list.find(p => p.id !== toKeep.id);
  } else {
    // Borrar el más recientemente actualizado (updated_at mayor)
    const sorted = [...list].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
    toKeep = sorted[0];
    toDelete = sorted[sorted.length - 1];
  }
  pairs.push({ name: key, toKeep, toDelete });
}

console.log(`\n📋 Plan de borrado (${pairs.length} duplicados):`);
for (const { name, toKeep, toDelete } of pairs) {
  console.log(`\n  "${name}"`);
  console.log(`    ✅ CONSERVAR: ${toKeep.code} (updated=${toKeep.updated_at?.slice(0,19)})`);
  console.log(`    🗑️  BORRAR:    ${toDelete.code} (updated=${toDelete.updated_at?.slice(0,19)})`);
}

if (!EXECUTE) {
  console.log(`\n⚠️  DRY-RUN: ejecuta con --execute para aplicar.`);
  process.exit(0);
}

// ====== EJECUCIÓN ======
console.log("\n🚀 Ejecutando borrados...");

async function reassignReferences(fromId, toId) {
  const moved = { purchase: 0, invoice: 0, returns: 0, movements: 0 };
  // purchase_items
  let { data: rows, error: err } = await supabase
    .from("purchase_items").select("id").eq("product_id", fromId);
  if (err) throw err;
  for (const r of rows || []) {
    const { error: ue } = await supabase.from("purchase_items").update({ product_id: toId }).eq("id", r.id);
    if (ue) throw ue;
    moved.purchase++;
  }
  // invoice_items
  ({ data: rows, error: err } = await supabase
    .from("invoice_items").select("id").eq("product_id", fromId));
  if (err) throw err;
  for (const r of rows || []) {
    const { error: ue } = await supabase.from("invoice_items").update({ product_id: toId }).eq("id", r.id);
    if (ue) throw ue;
    moved.invoice++;
  }
  // return_items
  ({ data: rows, error: err } = await supabase
    .from("return_items").select("id").eq("product_id", fromId));
  if (err) throw err;
  for (const r of rows || []) {
    const { error: ue } = await supabase.from("return_items").update({ product_id: toId }).eq("id", r.id);
    if (ue) throw ue;
    moved.returns++;
  }
  // inventory_movements
  ({ data: rows, error: err } = await supabase
    .from("inventory_movements").select("id").eq("product_id", fromId));
  if (err) throw err;
  for (const r of rows || []) {
    const { error: ue } = await supabase.from("inventory_movements").update({ product_id: toId }).eq("id", r.id);
    if (ue) throw ue;
    moved.movements++;
  }
  // inventory (UNIQUE product_id: si ambos tienen, fusionar stock)
  let { data: fromInv, error: fiErr } = await supabase
    .from("inventory").select("*").eq("product_id", fromId);
  if (fiErr) throw fiErr;
  let { data: toInv, error: tiErr } = await supabase
    .from("inventory").select("*").eq("product_id", toId);
  if (tiErr) throw tiErr;
  if ((fromInv || []).length > 0) {
    const f = fromInv[0];
    const t = (toInv || [])[0];
    if (t) {
      const mergedStock = (t.stock || 0) + (f.stock || 0);
      const mergedValue = (t.inventory_value || 0) + (f.inventory_value || 0);
      const avgCost = mergedStock > 0 ? mergedValue / mergedStock : 0;
      const { error: ue } = await supabase
        .from("inventory")
        .update({ stock: mergedStock, inventory_value: mergedValue, average_cost: avgCost })
        .eq("id", t.id);
      if (ue) throw ue;
      const { error: de } = await supabase.from("inventory").delete().eq("id", f.id);
      if (de) throw de;
    } else {
      const { error: ue } = await supabase
        .from("inventory").update({ product_id: toId }).eq("id", f.id);
      if (ue) throw ue;
    }
  }
  return moved;
}

let ok = 0, fail = 0;
for (const { name, toKeep, toDelete } of pairs) {
  try {
    const moved = await reassignReferences(toDelete.id, toKeep.id);
    const { error: delErr } = await supabase.from("products").delete().eq("id", toDelete.id);
    if (delErr) throw delErr;
    ok++;
    console.log(`   ✅ ${toDelete.code} → eliminado (referencias movidas: ${JSON.stringify(moved)})`);
  } catch (err) {
    fail++;
    console.log(`   ❌ ${toDelete.code} — ${err.message}`);
  }
}

console.log(`\n📊 Eliminados: ${ok} | Errores: ${fail}`);
