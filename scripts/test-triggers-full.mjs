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

async function col(table, limit = 1) {
  const { data, error } = await supabase.from(table).select("*").limit(limit);
  if (error) return { exists: false, error: error.message };
  return { exists: true, columns: data.length ? Object.keys(data[0]).sort() : [] };
}

console.log("=== Estado de tablas/columnas (de las migraciones) ===\n");

const checks = [
  ["clients (birthday, client_type, deleted_at)", "clients"],
  ["settings (currency, ai prompts)", "settings"],
  ["return_items (20250713_returns)", "return_items"],
  ["user_preferences (20250714)", "user_preferences"],
  ["credit_balances (pipeline)", "credit_balances"],
  ["bank_accounts (show_all)", "bank_accounts"],
  ["purchases", "purchases"],
  ["invoices", "invoices"],
  ["receipts", "receipts"],
];

for (const [label, table] of checks) {
  const r = await col(table);
  if (!r.exists) {
    console.log(`❌ ${label}: NO EXISTE (${r.error?.substring(0, 80)})`);
  } else {
    console.log(`✅ ${label}: ${r.columns.length} cols — ${r.columns.join(", ")}`);
  }
}

// Test trigger inventario compra correctamente (con purchase_date)
console.log("\n=== Test trigger trg_purchase_inventory ===");
const testCode = "ZZTEST" + Date.now();
const { data: prod, error: insErr } = await supabase
  .from("products")
  .insert({ code: testCode, name: "Test Trigger", cost: 1000, pv: 10, price_30: 1300, price_35: 1350, active: true })
  .select()
  .single();
if (insErr) {
  console.log("insert product error:", insErr.message);
} else {
  const { data: purchase, error: purErr } = await supabase
    .from("purchases")
    .insert({ purchase_number: "ZZT" + Date.now(), purchase_date: new Date().toISOString(), total: 2000, status: "COMPLETED" })
    .select()
    .single();
  if (purErr) {
    console.log("insert purchase error:", purErr.message);
  } else {
    const { error: piErr } = await supabase
      .from("purchase_items")
      .insert({ purchase_id: purchase.id, product_id: prod.id, quantity: 2, unit_cost: 1000, line_total: 2000 })
      .select()
      .single();
    if (piErr) {
      console.log("insert purchase_item error:", piErr.message);
    } else {
      const { data: inv } = await supabase.from("inventory").select("stock, average_cost, inventory_value").eq("product_id", prod.id).single();
      const ok = inv && Number(inv.stock) === 2 && Number(inv.inventory_value) === 2000 && Number(inv.average_cost) === 1000;
      console.log(`stock=${inv?.stock} avg=${inv?.average_cost} value=${inv?.inventory_value} → ${ok ? "✅ TRIGGER FUNCIONA" : "❌ TRIGGER NO FUNCIONA"}`);
      if (inv) await supabase.from("inventory").delete().eq("product_id", prod.id);
    }
    await supabase.from("purchases").delete().eq("id", purchase.id);
  }
  await supabase.from("products").delete().eq("id", prod.id);
}

// Test trigger venta (invoice_items)
console.log("\n=== Test trigger trg_sale_inventory ===");
const { data: prod2, error: insErr2 } = await supabase
  .from("products")
  .insert({ code: "ZZT2" + Date.now(), name: "Test Venta", cost: 1000, pv: 10, price_30: 1300, price_35: 1350, active: true })
  .select()
  .single();
if (insErr2) {
  console.log("insert product error:", insErr2.message);
} else {
  const { data: inv0 } = await supabase.from("inventory").select("stock").eq("product_id", prod2.id).single();
  const stock0 = Number(inv0?.stock ?? 0);
  const { data: invPre } = await supabase.from("inventory").upsert({ product_id: prod2.id, stock: 10, inventory_value: 10000, average_cost: 1000, minimum_stock: 3 }, { onConflict: "product_id" }).select().single();
  const { data: client, error: cErr } = await supabase.from("clients").select("id").limit(1).single();
  if (cErr) {
    console.log("no client:", cErr.message);
  } else {
    const { data: invoice, error: iErr } = await supabase
      .from("invoices")
      .insert({ invoice_number: "ZZF" + Date.now(), invoice_date: new Date().toISOString(), client_id: client.id, total: 2600, amount_paid: 0, status: "PENDING" })
      .select()
      .single();
    if (iErr) {
      console.log("insert invoice error:", iErr.message);
    } else {
      const { error: iiErr } = await supabase
        .from("invoice_items")
        .insert({ invoice_id: invoice.id, product_id: prod2.id, quantity: 1, unit_price: 1300, unit_cost: 1000, line_total: 1300, pv: 10 })
        .select()
        .single();
      if (iiErr) {
        console.log("insert invoice_item error:", iiErr.message);
      } else {
        const { data: invAfter } = await supabase.from("inventory").select("stock").eq("product_id", prod2.id).single();
        console.log(`stock antes=${invPre?.stock} después=${invAfter?.stock} → ${Number(invAfter?.stock) === Number(invPre?.stock) - 1 ? "✅ TRIGGER VENTA FUNCIONA" : "❌ TRIGGER VENTA NO FUNCIONA (o stock quedó en ${stock0})"}`);
        await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
      }
      await supabase.from("invoices").delete().eq("id", invoice.id);
    }
  }
  await supabase.from("inventory").delete().eq("product_id", prod2.id);
  await supabase.from("products").delete().eq("id", prod2.id);
}
console.log("\n✅ Tests completados");
