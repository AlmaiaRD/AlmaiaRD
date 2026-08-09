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

const { data: purchases } = await supabase.from("purchases").select("*").limit(1000);
const { data: purchaseItems } = await supabase.from("purchase_items").select("*").limit(100000);
const { data: products } = await supabase.from("products").select("id, code, apply_itbis, cost");
const prodMap = new Map((products || []).map((p) => [p.id, { code: p.code, apply_itbis: p.apply_itbis }]));

console.log("=== RECONCILIACIÓN COMPRAS (con impuestos) ===");
for (const p of purchases || []) {
  const its = (purchaseItems || []).filter((it) => it.purchase_id === p.id);
  const sumSubtotal = its.reduce((s, it) => s + Number(it.line_total || 0), 0);
  const sumItbisLine = its.reduce((s, it) => s + Number(it.line_itbis || 0), 0);
  const recalc = Number(p.subtotal || 0) + Number(p.itbis || 0) + Number(p.impuesto_recogida || 0) + Number(p.cargo_administracion || 0) - Number(p.discount_amount || 0);
  const ok = Math.abs(recalc - Number(p.total || 0)) < 1 && Math.abs(sumSubtotal - Number(p.subtotal || 0)) < 1;
  console.log(`${p.purchase_number ?? p.id} total=${p.total} subtotal=${p.subtotal} itbis=${p.itbis} recogida=${p.impuesto_recogida} admin=${p.cargo_administracion} desc=${p.discount_amount}`);
  console.log(`   Σline_total=${sumSubtotal} | Σline_itbis=${sumItbisLine.toFixed(2)} | recalc=${recalc.toFixed(2)} → ${ok ? "✅ CONSISTENTE" : "❌ MISMATCH"}`);
}

console.log("\n=== ¿Los items de compra conservan su línea? (comparar line_total vs unit_cost*quantity) ===");
let okItems = 0, badItems = 0;
for (const p of purchases || []) {
  const its = (purchaseItems || []).filter((it) => it.purchase_id === p.id);
  for (const it of its) {
    const expected = Number(it.unit_cost || 0) * Number(it.quantity || 0);
    if (Math.abs(expected - Number(it.line_total || 0)) < 0.01) okItems++;
    else { badItems++; console.log(`   ❌ ${p.purchase_number}: item ${it.id} unit_cost=${it.unit_cost} × qty=${it.quantity} = ${expected} ≠ line_total=${it.line_total}`); }
  }
}
console.log(`items consistentes: ${okItems} | inconsistentes: ${badItems}`);

console.log("\n=== ¿Algún item de compra/factura apunta a producto con apply_itbis=false pero línea con itbis=true? ===");
for (const p of purchases || []) {
  const its = (purchaseItems || []).filter((it) => it.purchase_id === p.id);
  for (const it of its) {
    const prod = prodMap.get(it.product_id);
    if (it.itbis && prod && prod.apply_itbis === false) {
      console.log(`   ⚠️ ${p.purchase_number}: ${prod.code} tiene itbis=true en línea pero apply_itbis=false`);
    }
  }
}
console.log("revisión completa");
