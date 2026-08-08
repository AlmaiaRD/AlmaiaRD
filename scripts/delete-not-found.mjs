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

const { data: products, error } = await supabase.from("products").select("id, code, name, active, created_at");
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

// Los 14 códigos numéricos no encontrados en Amway RD
const codesToDelete = [
  "116745", "123791", "125325", "116733", "116734", "116736",
  "116737", "116739", "120361", "120362", "124163", "120364",
  "120365", "120872",
];

const targets = (products || []).filter(p => codesToDelete.includes(p.code) && !p.active);

console.log(`\n🗑️  Se eliminarán ${targets.length} productos no encontrados en Amway RD:\n`);
for (const p of targets) {
  console.log(`   ${p.code} — ${p.name}`);
}

let deleted = 0;
let errors = 0;
for (const p of targets) {
  try {
    // Limpiar dependencias (compra, factura, inventario, movimientos, devoluciones)
    const tables = [
      ["purchase_items", "product_id"],
      ["invoice_items", "product_id"],
      ["inventory", "product_id"],
      ["inventory_movements", "product_id"],
      ["return_items", "product_id"],
      ["returns", "product_id"],
    ];
    for (const [table, col] of tables) {
      await supabase.from(table).delete().eq(col, p.id);
    }
    const { error: delErr } = await supabase.from("products").delete().eq("id", p.id);
    if (delErr) throw delErr;
    deleted++;
    console.log(`   ✅ Eliminado: ${p.code} — ${p.name}`);
  } catch (err) {
    errors++;
    console.log(`   ❌ Error: ${p.code} — ${err.message}`);
  }
}

console.log(`\n📊 Eliminados: ${deleted} | Errores: ${errors}`);
