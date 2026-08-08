#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

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

const { error: ae } = await supabase.auth.signInWithPassword({ email: "admin@almaia.com", password: "Admin123!" });
if (ae) { console.error(ae.message); process.exit(1); }

// Detectar existencia de funciones intentando llamarlas con args "obvio no válidos"
// Si la función NO existe: error "Could not find the function public.X(...) in the schema cache"
// Si existe: error de permisos o de ejecución, pero no "could not find"
const calls = [
  ["add_inventory_stock", { p_product_id: "00000000-0000-0000-0000-000000000000", p_quantity: 0, p_unit_cost: 0, p_line_total: 0 }],
  ["subtract_inventory_stock", { p_product_id: "00000000-0000-0000-0000-000000000000", p_quantity: 0 }],
  ["restore_inventory_stock", { p_product_id: "00000000-0000-0000-0000-000000000000", p_quantity: 0 }],
  ["adjust_invoice_payment", { p_invoice_id: "00000000-0000-0000-0000-000000000000", p_diff: 0 }],
];

for (const [name, args] of calls) {
  const { error } = await supabase.rpc(name, args);
  const msg = error?.message || "OK (sin error)";
  const notFound = /could not find the function/i.test(msg);
  console.log(`${notFound ? "❌ NO EXISTE" : "✅ existe"}  ${name}: ${msg.substring(0, 120)}`);
}

// Verificar también funciones del schema principal usadas por triggers
const fnChecks = ["fn_calculate_invoice_totals", "fn_update_inventory_on_sale", "fn_update_inventory_on_purchase", "fn_restore_inventory_on_cancellation", "fn_generate_invoice_number", "fn_handle_excess_payment", "fn_update_invoice_on_receipt"];
for (const f of fnChecks) {
  // Estas funciones requieren args complejos; mejor probar con args vacíos para detectar su existencia
  const { error } = await supabase.rpc(f, {});
  const msg = error?.message || "OK";
  const notFound = /could not find the function/i.test(msg);
  const ambiguous = /is not defined|missing|was called with/;
  console.log(`${notFound ? "❌ NO EXISTE" : "✅ existe"}  ${f}: ${msg.substring(0, 100)}`);
}
