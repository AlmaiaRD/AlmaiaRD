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

// Producto temporal
const testCode = "ZZRPC" + Date.now();
const { data: prod, error: pe } = await supabase
  .from("products")
  .insert({ code: testCode, name: "Test RPC", cost: 500, pv: 3, price_30: 650, price_35: 675, active: true })
  .select()
  .single();
if (pe) { console.error("insert product:", pe.message); process.exit(1); }

console.log(`Producto test: ${testCode}`);

// 1. add_inventory_stock — misma firma que usa la app (p_product_id, p_quantity, p_unit_cost, p_line_total)
const { error: e1 } = await supabase.rpc("add_inventory_stock", { p_product_id: prod.id, p_quantity: 5, p_unit_cost: 500, p_line_total: 2500 });
console.log(`add_inventory_stock(5, 500, 2500): ${e1 ? "❌ " + e1.message : "✅ ok"}`);

const { data: inv1 } = await supabase.from("inventory").select("stock, average_cost, inventory_value").eq("product_id", prod.id).single();
console.log(`  stock=${inv1?.stock} (esp 5) avg=${inv1?.average_cost} (esp 500) value=${inv1?.inventory_value} (esp 2500)`);
const ok1 = inv1 && Number(inv1.stock) === 5 && Number(inv1.inventory_value) === 2500;

// 2. subtract_inventory_stock
const { error: e2 } = await supabase.rpc("subtract_inventory_stock", { p_product_id: prod.id, p_quantity: 2 });
console.log(`subtract_inventory_stock(2): ${e2 ? "❌ " + e2.message : "✅ ok"}`);
const { data: inv2 } = await supabase.from("inventory").select("stock, pending_return").eq("product_id", prod.id).single();
console.log(`  stock=${inv2?.stock} (esp 3)`);
const ok2 = inv2 && Number(inv2.stock) === 3;

// 3. restore_inventory_stock
const { error: e3 } = await supabase.rpc("restore_inventory_stock", { p_product_id: prod.id, p_quantity: 2 });
console.log(`restore_inventory_stock(2): ${e3 ? "❌ " + e3.message : "✅ ok"}`);
const { data: inv3 } = await supabase.from("inventory").select("stock").eq("product_id", prod.id).single();
console.log(`  stock=${inv3?.stock} (esp 5)`);
const ok3 = inv3 && Number(inv3.stock) === 5;

console.log(`\nRESULTADO: ${ok1 && ok2 && ok3 ? "✅ TODO FUNCIONA — bloqueo resuelto" : "❌ aún hay problemas"}`);

// Limpieza
await supabase.from("inventory").delete().eq("product_id", prod.id);
await supabase.from("products").delete().eq("id", prod.id);
console.log("limpieza ok");
