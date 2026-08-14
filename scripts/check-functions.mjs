#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

import { adminCredentials } from "./_auth.mjs";
const creds = adminCredentials();
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  realtime: { transport: ws },
  auth: { persistSession: false },
});

const { error: ae } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
if (ae) { console.error(ae.message); process.exit(1); }

// Lista de funciones que se esperan en la BD (schema public)
const expected = [
  "add_inventory_stock",
  "subtract_inventory_stock",
  "restore_inventory_stock",
  "adjust_invoice_payment",
  "use_credit_balance",
  "fn_generate_invoice_number",
  "fn_calculate_product_prices",
  "fn_public_functions",
];

// Consultar el catálogo real de funciones vía helper (creado en fix-inventory-movements.sql).
// Este método NO invoca las funciones, así que no produce falsos negativos por argumentos faltantes.
const { data: catalog, error: catErr } = await supabase.rpc("fn_public_functions");

if (catErr) {
  console.warn("⚠️  fn_public_functions() no disponible. Ejecuta scripts/fix-inventory-movements.sql en el SQL Editor.\n");
  console.warn("Fallo del helper:", catErr.message);
  process.exit(1);
}

const existing = new Set((catalog || []).map((r) => r.fn_name));

console.log("=== Funciones en schema public (vía pg_proc) ===");
for (const f of expected) {
  console.log(`${existing.has(f) ? "✅ existe" : "❌ NO EXISTE"}  ${f}`);
}

console.log("\n=== Funciones extra encontradas ===");
const extras = (catalog || []).filter((r) => !expected.includes(r.fn_name)).map((r) => r.fn_name);
console.log(extras.length ? extras.join(", ") : "(ninguna)");
