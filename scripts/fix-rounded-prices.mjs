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

const EXECUTE = process.argv.includes("--execute");

const roundToNearest50 = (v) => Math.ceil(v / 50) * 50;

const { data: prods } = await supabase
  .from("products")
  .select("id, code, name, cost, price_30, price_35, apply_itbis, active")
  .order("code");

let toUpdate = 0, unchanged = 0, skipped = 0, zeroCost = 0;

console.log(`${EXECUTE ? "=== APLICANDO CORRECCIONES ===" : "=== DRY-RUN (usa --execute para aplicar) ==="}`);
console.log("Fórmula: precio base = roundUp50(cost × markup). El ITBIS lo aplica la app al total.\n");

for (const p of prods || []) {
  if (!p.active) { skipped++; continue; }
  const base = Number(p.cost || 0);
  if (base <= 0) { zeroCost++; skipped++; continue; }
  const new30 = roundToNearest50(base * 1.3);
  const new35 = roundToNearest50(base * 1.35);

  const same = new30 === Number(p.price_30) && new35 === Number(p.price_35);
  if (same) { unchanged++; continue; }

  toUpdate++;
  console.log(`${p.code} | ${p.name.slice(0, 45)} | 30%: ${p.price_30} → ${new30} | 35%: ${p.price_35} → ${new35}`);

  if (EXECUTE) {
    const { error } = await supabase
      .from("products")
      .update({ price_30: new30, price_35: new35 })
      .eq("id", p.id);
    if (error) console.log(`   ❌ ${error.message}`);
  }
}

console.log(`\n=== RESUMEN ===`);
console.log(`a actualizar/corregidos: ${toUpdate} | ya correctos: ${unchanged} | inactivos omitidos: ${skipped} | sin costo (omitidos): ${zeroCost}`);
