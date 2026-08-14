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

const { data: invoices } = await supabase.from("invoices").select("*").limit(1000);
const { data: items } = await supabase.from("invoice_items").select("*").limit(100000);
const { data: products } = await supabase.from("products").select("id, code, name");
const prodMap = new Map((products || []).map((p) => [p.id, `${p.code}`]));

console.log("=== RECONCILIACIÓN: total guardado vs subtotal+itbis-discount y vs items ===");
for (const inv of invoices || []) {
  const its = (items || []).filter((it) => it.invoice_id === inv.id);
  const sumLines = its.reduce((s, it) => s + Number(it.line_total || 0), 0);
  const sumItbisAmount = its.reduce((s, it) => s + Number(it.itbis_amount || 0), 0);
  const sumLinesPlusItbis = sumLines + sumItbisAmount;
  const recalc = Number(inv.subtotal || 0) + Number(inv.itbis_total || 0) - Number(inv.discount_amount || 0);

  const c1 = Math.abs(recalc - Number(inv.total || 0)) > 1 ? "❌ campos" : "✅ campos";
  const c2 = Math.abs(sumLines - Number(inv.subtotal || 0)) > 1 ? "❌ items vs subtotal" : "✅ items vs subtotal";
  const c3 = Math.abs(sumLinesPlusItbis - Number(inv.total || 0)) > 1 ? "❌ items+itbis vs total" : "✅ items+itbis vs total";

  const mismatches = [c1, c2, c3].filter((c) => c.startsWith("❌"));
  console.log(`\n${inv.invoice_number ?? inv.id} total=${inv.total} subtotal=${inv.subtotal} itbis=${inv.itbis_total} desc=${inv.discount_amount}`);
  console.log(`   campos recalc=${recalc.toFixed(2)}: ${c1}`);
  console.log(`   Σline_total=${sumLines} vs subtotal ${inv.subtotal}: ${c2}`);
  console.log(`   Σ(line+itbis_amt)=${sumLinesPlusItbis.toFixed(2)} vs total ${inv.total}: ${c3}`);
  if (its.length === 0 && !String(inv.invoice_number).startsWith("ZZF")) {
    console.log(`   ⚠️ FACTURA REAL SIN ITEMS`);
  }
  for (const it of its) {
    const itbisFlag = it.itbis ? "(ITBIS)" : "";
    console.log(`      ${prodMap.get(it.product_id) ?? "❌PROD"} ×${it.quantity} @${it.unit_price} = ${it.line_total} itbis_amt=${it.itbis_amount || 0} ${itbisFlag}`);
  }
}
