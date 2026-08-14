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

const prodMap = new Map((products || []).map((p) => [p.id, `${p.code} — ${p.name}`]));

console.log("=== DETALLE DE FACTURAS ===");
for (const inv of invoices || []) {
  const its = (items || []).filter((it) => it.invoice_id === inv.id);
  const sum = its.reduce((s, it) => s + Number(it.line_total || 0), 0);
  const mismatch = inv.total != null && Math.abs(Number(inv.total) - sum) > 1;
  const flag = its.length === 0 ? "⚠️ SIN ITEMS" : mismatch ? "⚠️ MISMATCH" : "✅ ok";
  console.log(`\n${inv.invoice_number ?? inv.id} (${inv.invoice_date ?? inv.created_at?.slice(0,10)}) total=${inv.total} Σitems=${sum} status=${inv.status ?? "?"} ${flag}`);
  for (const it of its) {
    console.log(`   ${prodMap.get(it.product_id) ?? "❌ producto ELIMINADO"} ×${it.quantity} @ ${it.unit_price} = ${it.line_total}`);
  }
}
