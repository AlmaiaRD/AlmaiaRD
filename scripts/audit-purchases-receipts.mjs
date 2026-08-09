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

// Códigos eliminados en los cambios de catálogo
const deletedCodes = [
  "116745", "123791", "125325", "116733", "116734", "116736", "116737", "116739",
  "120361", "120362", "124163", "120364", "120365", "120872", "102736", "124692",
  "118761", "110170", "109741", "127065",
];

const { data: products } = await supabase.from("products").select("id, code, name");
const prodMap = new Map((products || []).map((p) => [p.id, `${p.code} — ${p.name}`]));

console.log("=== COMPRAS (reconciliación) ===");
const { data: purchases } = await supabase.from("purchases").select("*").limit(1000);
const { data: purchaseItems } = await supabase.from("purchase_items").select("*").limit(100000);
for (const p of purchases || []) {
  const its = (purchaseItems || []).filter((it) => it.purchase_id === p.id);
  const sum = its.reduce((s, it) => s + Number(it.line_total || 0), 0);
  const ok = p.total != null && Math.abs(Number(p.total) - sum) < 1;
  console.log(`${p.purchase_number ?? p.id} total=${p.total} Σitems=${sum} → ${ok ? "✅" : "❌ MISMATCH"}`);
  for (const it of its) console.log(`   ${prodMap.get(it.product_id) ?? "❌PROD"} ×${it.quantity} @${it.unit_cost} = ${it.line_total}`);
}

console.log("\n=== RECIBOS ===");
const { data: receipts } = await supabase.from("receipts").select("*").limit(1000);
for (const r of receipts || []) {
  console.log(`${r.receipt_number ?? r.id} total=${r.total} tipo=${r.receipt_type ?? r.payment_method ?? "?"} fecha=${r.receipt_date ?? r.created_at?.slice(0,10)}`);
}

console.log("\n=== ¿Los códigos eliminados aparecen en documentos? ===");
const allItems = [...(purchaseItems || []), ...(await supabase.from("invoice_items").select("*").limit(100000)).data || []];
let refs = 0;
for (const it of allItems) {
  const prod = prodMap.get(it.product_id);
  if (prod && deletedCodes.includes(prod.split(" — ")[0])) {
    console.log(`⚠️ ${prod} referenciado en ${it.invoice_id ? "factura" : "compra"}`);
    refs++;
  }
}
console.log(refs === 0 ? "✅ Ninguno de los códigos eliminados está referenciado en facturas ni compras" : `❌ ${refs} referencias encontradas`);
