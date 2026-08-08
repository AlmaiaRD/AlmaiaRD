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
  .select("id, code, name, active, cost, pv, price_30, price_35, image_url, description, subcategory, subbrand_id, apply_itbis, duracion_dias, created_at, updated_at");
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

console.log("\n=== DETALLE DE DUPLICADOS ===");
let count = 0;
for (const key of Object.keys(byName)) {
  if (byName[key].length > 1) {
    count++;
    console.log(`\n${count}. "${key}"`);
    for (const p of byName[key]) {
      console.log(`   code=${p.code} | updated=${p.updated_at?.slice(0,19)}`);
      console.log(`      cost=${p.cost} pv=${p.pv} p30=${p.price_30} p35=${p.price_35} | img=${p.image_url ? "SÍ" : "NO"} | cat=${p.subcategory || "—"} | itbis=${p.apply_itbis} | dur=${p.duracion_dias}`);
      console.log(`      desc=${(p.description || "").slice(0, 90)}`);
    }
  }
}
console.log(`\nTotal grupos: ${count}`);

// Contar referencias por producto duplicado
console.log("\n=== REFERENCIAS (compras/facturas/inventario) ===");
for (const key of Object.keys(byName)) {
  if (byName[key].length < 2) continue;
  for (const p of byName[key]) {
    const [pi, ii, inv, im] = await Promise.all([
      supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("invoice_items").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("inventory").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("inventory_movements").select("id", { count: "exact", head: true }).eq("product_id", p.id),
    ]);
    console.log(`   ${p.code} | compras=${pi.count} facturas=${ii.count} inv=${inv.count} mov=${im.count}`);
  }
}
