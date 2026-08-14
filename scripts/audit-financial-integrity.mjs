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
console.log("✅ Autenticado como admin\n");

const counts = {};
const orphans = {};
const problems = [];

async function count(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return { error: error.message };
  return { count: count ?? 0 };
}

async function getAll(table, limit = 100000) {
  const { data, error } = await supabase.from(table).select("*").limit(limit);
  if (error) return { error: error.message };
  return { data: data || [] };
}

// 1. Conteos de tablas financieras
console.log("=== 1. Conteos de tablas financieras ===");
for (const t of [
  "invoices", "invoice_items", "receipts", "purchases", "purchase_items",
  "returns", "return_items", "inventory_movements", "inventory", "clients", "products",
]) {
  const r = await count(t);
  counts[t] = r.count ?? 0;
  console.log(`${t}: ${r.error ? "❌ " + r.error : r.count}`);
}

// 2. Referencias huérfanas (product_id que apunta a producto inexistente)
console.log("\n=== 2. Referencias huérfanas a products ===");
const allProducts = await getAll("products");
const productIds = new Set((allProducts.data || []).map((p) => p.id));
console.log(`productos en BD: ${productIds.size}`);

for (const [table, col] of [
  ["invoice_items", "product_id"],
  ["purchase_items", "product_id"],
  ["return_items", "product_id"],
  ["inventory_movements", "product_id"],
  ["inventory", "product_id"],
]) {
  const r = await getAll(table);
  if (r.error) { console.log(`${table}: ❌ ${r.error}`); continue; }
  const bad = (r.data || []).filter((row) => row[col] && !productIds.has(row[col]));
  orphans[table] = bad.length;
  console.log(`${table}: ${bad.length} huérfanas de ${(r.data || []).length}`);
  if (bad.length) {
    for (const b of bad.slice(0, 10)) console.log(`   ⚠️ id=${b.id} product_id=${b[col]}`);
  }
}

// 3. Facturas sin items y con items no encontrados
console.log("\n=== 3. Facturas dañadas (sin items o total inconsistente) ===");
const invs = await getAll("invoices");
const invItems = await getAll("invoice_items");
if (invs.error) console.log("invoices:", invs.error);
else {
  const itemsByInvoice = {};
  for (const it of invItems.data || []) {
    (itemsByInvoice[it.invoice_id] ||= []).push(it);
  }
  let noItems = 0, totalMismatch = 0;
  for (const inv of invs.data || []) {
    const items = itemsByInvoice[inv.id] || [];
    if (items.length === 0) { noItems++; problems.push(`Factura ${inv.invoice_number ?? inv.id} SIN items (total=${inv.total})`); }
    const sumItems = items.reduce((s, it) => s + Number(it.line_total || 0), 0);
    const recalc = Number(inv.subtotal || 0) + Number(inv.itbis_total || 0) - Number(inv.discount_amount || 0);
    if (items.length > 0 && inv.total != null && Math.abs(recalc - Number(inv.total)) > 1) {
      totalMismatch++;
      problems.push(`Factura ${inv.invoice_number ?? inv.id}: total=${inv.total} ≠ subtotal+itbis-desc=${recalc}`);
    }
    if (items.length > 0 && Math.abs(sumItems - Number(inv.subtotal || 0)) > 1) {
      totalMismatch++;
      problems.push(`Factura ${inv.invoice_number ?? inv.id}: subtotal=${inv.subtotal} ≠ Σitems=${sumItems}`);
    }
  }
  console.log(`facturas totales: ${invs.data.length}`);
  console.log(`facturas sin items: ${noItems}`);
  console.log(`facturas con total inconsistente: ${totalMismatch}`);
}

// 4. Compras sin items
console.log("\n=== 4. Compras sin items ===");
const pcs = await getAll("purchases");
const pcItems = await getAll("purchase_items");
if (pcs.error) console.log("purchases:", pcs.error);
else {
  const itemsByPurchase = {};
  for (const it of pcItems.data || []) (itemsByPurchase[it.purchase_id] ||= []).push(it);
  let noItems = 0;
  for (const p of pcs.data || []) {
    if (!(itemsByPurchase[p.id] || []).length) { noItems++; problems.push(`Compra ${p.purchase_number ?? p.id} SIN items (total=${p.total})`); }
  }
  console.log(`compras totales: ${pcs.data.length} | sin items: ${noItems}`);
}

// 5. Devoluciones sin items
console.log("\n=== 5. Devoluciones sin items ===");
const rets = await getAll("returns");
const retItems = await getAll("return_items");
if (rets.error) console.log("returns:", rets.error);
else {
  const itemsByReturn = {};
  for (const it of retItems.data || []) (itemsByReturn[it.return_id] ||= []).push(it);
  let noItems = 0;
  for (const r of rets.data || []) {
    if (!(itemsByReturn[r.id] || []).length) { noItems++; problems.push(`Devolución ${r.return_number ?? r.id} SIN items`); }
  }
  console.log(`devoluciones totales: ${rets.data.length} | sin items: ${noItems}`);
}

// 6. Recibos
console.log("\n=== 6. Recibos ===");
const rcts = await getAll("receipts");
if (rcts.error) console.log("receipts:", rcts.error || `total: ${rcts.data.length}`);
else console.log(`recibos totales: ${rcts.data.length}`);

// 7. Inventario con stock inconsistente vs movimientos (solo conteo de duplicados)
console.log("\n=== 7. Inventario ===");
const invAll = await getAll("inventory");
if (invAll.error) console.log("inventory:", invAll.error);
else {
  const byProduct = {};
  for (const i of invAll.data || []) (byProduct[i.product_id] ||= []).push(i);
  const dupes = Object.entries(byProduct).filter(([, v]) => v.length > 1);
  console.log(`filas inventory: ${invAll.data.length} | productos con doble fila: ${dupes.length}`);
  if (dupes.length) for (const [pid, rows] of dupes) problems.push(`inventory duplicado para product ${pid} (${rows.length} filas)`);
}

console.log("\n=========================================");
console.log(`RESULTADO: ${problems.length === 0 && Object.values(orphans).every((v) => v === 0) ? "✅ TODO INTACTO" : "⚠️ PROBLEMAS DETECTADOS"}`);
console.log("=========================================");
if (problems.length) {
  console.log("\nProblemas:");
  for (const p of problems) console.log(`  - ${p}`);
}
