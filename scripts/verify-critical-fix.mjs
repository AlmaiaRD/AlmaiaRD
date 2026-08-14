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

console.log("=== Verificación post-fix ===");

// 1. Trigger de precios: insert sin price_30/35 debe calcular con fórmula nueva
const code = "ZZFIX" + Date.now();
const { data: prod } = await supabase.from("products").insert({ code, name: "Prod Fix Test", cost: 1000, active: true, apply_itbis: false }).select().single();
console.log("\n1) Trigger precios (cost=1000, sin ITBIS):");
console.log(`   price_30=${prod?.price_30} (esperado 1300) | price_35=${prod?.price_35} (esperado 1350)`, prod?.price_30 === 1300 && prod?.price_35 === 1350 ? "✅" : "❌");

// con ITBIS
const { data: prod2 } = await supabase.from("products").insert({ code: code + "B", name: "Prod Fix Test ITBIS", cost: 1000, active: true, apply_itbis: true }).select().single();
console.log(`   (cost=1000, CON ITBIS): price_30=${prod2?.price_30} (esperado 1550) | price_35=${prod2?.price_35} (esperado 1600)`, prod2?.price_30 === 1550 && prod2?.price_35 === 1600 ? "✅" : "❌");

// 2. Trigger precios NO pisa precios manuales
const { data: prod3 } = await supabase.from("products").insert({ code: code + "C", name: "Prod Manual", cost: 1000, active: true, apply_itbis: false, price_30: 999, price_35: 888 }).select().single();
console.log(`   (precio manual 999/888): p30=${prod3?.price_30} p35=${prod3?.price_35}`, prod3?.price_30 === 999 && prod3?.price_35 === 888 ? "✅ (no pisado)" : "❌ (pisado)");

// 3. Doble conteo: insert recibo + RPC → amount_paid debe ser 1000, no 2000
const { data: client } = await supabase.from("clients").insert({ full_name: "Cliente Fix Test", phone: "000" }).select().single();
const { data: invoice } = await supabase.from("invoices").insert({
  invoice_number: "ZZFAC" + Date.now(), client_id: client.id, invoice_date: new Date().toISOString().slice(0,10),
  total: 1500, subtotal: 1500, status: "PENDING", margin: 30
}).select().single();
const r1 = await supabase.from("receipts").insert({ receipt_number: "ZZREC" + Date.now(), client_id: client.id, invoice_id: invoice.id, payment_method: "CASH", amount: 1000 }).select().single();
const rpc = await supabase.rpc("adjust_invoice_payment", { p_invoice_id: invoice.id, p_diff: 1000 });
console.log("\n2) Doble conteo (recibo 1000 + RPC 1000):");
console.log("   insert:", r1.error ? "❌ " + r1.error.message : "ok", "| rpc:", rpc.error ? "❌ " + rpc.error.message : "ok");
const { data: invChk } = await supabase.from("invoices").select("amount_paid, balance_due").eq("id", invoice.id).single();
console.log(`   amount_paid=${invChk?.amount_paid} (esperado 1000; 2000 = doble conteo)`, invChk?.amount_paid === 1000 ? "✅ FIX OK" : invChk?.amount_paid === 2000 ? "❌ SIGUE EL DOBLE CONTEO" : `⚠️ ${invChk?.amount_paid}`);

// 4. deleteReceipt revierte amount_paid
const del = await supabase.rpc("adjust_invoice_payment", { p_invoice_id: invoice.id, p_diff: -1000 });
console.log("\n3) Revertir pago (RPC diff -1000):", del.error ? "❌ " + del.error.message : "ok");

// Limpieza
await supabase.from("receipts").delete().eq("id", r1.data?.id);
await supabase.from("invoices").delete().eq("id", invoice.id);
await supabase.from("clients").delete().eq("id", client.id);
await supabase.from("inventory").delete().eq("product_id", prod?.id);
await supabase.from("inventory").delete().eq("product_id", prod2?.id);
await supabase.from("inventory").delete().eq("product_id", prod3?.id);
await supabase.from("products").delete().eq("code", code);
await supabase.from("products").delete().eq("code", code + "B");
await supabase.from("products").delete().eq("code", code + "C");
console.log("\nlimpieza ok");
