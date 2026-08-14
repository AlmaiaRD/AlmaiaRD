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

const { data: products, error } = await supabase.from("products").select("id, code, name, active");
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

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

const failedCodes = ["102736", "124692", "118761"];

let fixed = 0;
let errors = 0;

for (const key of Object.keys(byName)) {
  const list = byName[key];
  const active = list.filter((p) => p.active);
  const inactive = list.filter((p) => !p.active && failedCodes.includes(p.code));
  if (inactive.length === 0 || active.length === 0) continue;

  for (const p of inactive) {
    const target = active[0];
    try {
      const { data: purchaseItems, error: piErr } = await supabase
        .from("purchase_items")
        .select("id, purchase_id")
        .eq("product_id", p.id);
      if (piErr) throw piErr;

      for (const item of purchaseItems || []) {
        const { error: updErr } = await supabase
          .from("purchase_items")
          .update({ product_id: target.id })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      const { data: invoiceItems, error: iiErr } = await supabase
        .from("invoice_items")
        .select("id, invoice_id")
        .eq("product_id", p.id);
      if (iiErr) throw iiErr;

      for (const item of invoiceItems || []) {
        const { error: updErr } = await supabase
          .from("invoice_items")
          .update({ product_id: target.id })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      const { error: delErr } = await supabase.from("products").delete().eq("id", p.id);
      if (delErr) throw delErr;

      fixed++;
      console.log(`   ✅ ${p.code} → reasignado a ${target.code} y eliminado (${purchaseItems?.length || 0} compras, ${invoiceItems?.length || 0} facturas)`);
    } catch (err) {
      errors++;
      console.log(`   ❌ ${p.code} — ${err.message}`);
    }
  }
}

console.log(`\n📊 Reasignados y eliminados: ${fixed} | Errores: ${errors}`);
