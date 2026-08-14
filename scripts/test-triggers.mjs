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

// Test 1: trigger de precios — insert y luego SELECT separado
const testCode = "ZZTEST" + Date.now();
const { data: prod, error: insErr } = await supabase
  .from("products")
  .insert({ code: testCode, name: "Producto Test Temporal", cost: 1000, active: true, pv: 10 })
  .select()
  .single();
if (insErr) {
  console.log("insert error:", insErr.message);
  process.exit(1);
}
const { data: prod2 } = await supabase.from("products").select("code, cost, price_30, price_35").eq("id", prod.id).single();
console.log(`Test trg_calculate_prices (SELECT separado): cost=${prod2?.cost} p30=${prod2?.price_30} (esp 1300) p35=${prod2?.price_35} (esp 1350)`);
const triggerWorks = prod2?.price_30 === 1300 && prod2?.price_35 === 1350;
console.log(triggerWorks ? "✅ Trigger precios FUNCIONA" : "❌ Trigger precios NO existe/no funciona");

// Test 2: trigger de inventario en compra (purchase_items)
const { data: inv } = await supabase.from("inventory").select("*").eq("product_id", prod.id).single();
const stockBefore = Number(inv?.stock ?? 0);
const { data: purchase, error: purErr } = await supabase
  .from("purchases")
  .insert({ purchase_number: "ZZTEST" + Date.now(), total: 2000, status: "COMPLETED", supplier_id: null, created_by: null })
  .select()
  .single();
let purchaseItemErr = null;
let purchaseItem = null;
if (!purErr) {
  const r = await supabase
    .from("purchase_items")
    .insert({ purchase_id: purchase.id, product_id: prod.id, quantity: 2, unit_cost: 1000, line_total: 2000 })
    .select()
    .single();
  purchaseItemErr = r.error;
  purchaseItem = r.data;
}
console.log("\nTest trg_purchase_inventory:");
if (purErr) console.log("  insert purchase error:", purErr.message);
if (purchaseItemErr) console.log("  insert purchase_item error:", purchaseItemErr.message);
if (!purErr && !purchaseItemErr) {
  const { data: inv2 } = await supabase.from("inventory").select("stock, average_cost, inventory_value").eq("product_id", prod.id).single();
  console.log(`  stock: ${inv2?.stock} (esperado ${stockBefore + 2}) | avg_cost: ${inv2?.average_cost} (esp 1000) | value: ${inv2?.inventory_value} (esp 2000)`);
  const ok = inv2 && Number(inv2.stock) === stockBefore + 2 && Number(inv2.inventory_value) === 2000;
  console.log(ok ? "  ✅ Trigger inventario compra FUNCIONA" : "  ❌ Trigger inventario compra NO funciona");
}

// Limpieza
if (purchaseItem) await supabase.from("purchase_items").delete().eq("id", purchaseItem.id).then(({ error }) => error && console.log("  limpieza purchase_item:", error.message));
if (purchase) await supabase.from("purchases").delete().eq("id", purchase.id).then(({ error }) => error && console.log("  limpieza purchase:", error.message));
if (prod) await supabase.from("products").delete().eq("id", prod.id).then(({ error }) => error && console.log("  limpieza product:", error.message));
if (inv) await supabase.from("inventory").delete().eq("product_id", prod.id).catch(() => {});
console.log("\n✅ limpieza completada");
