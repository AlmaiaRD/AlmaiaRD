#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { realtime: { transport: ws }, auth: { persistSession: false } }
);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: "admin@almaia.com",
  password: "Admin123!",
});
if (authError) {
  console.error("ERROR auth:", authError.message);
  process.exit(1);
}

const codesToReactivate = ["127833D","127835D","127836D","127837D","127838D","127839D","127840D","127841D","127842D","127843D","A4042","A5923","A7553","A8600","AD5113","E0001"];

const { data: prods, error: pe } = await supabase
  .from("products")
  .select("id, code, name, active, cost, pv, price_30, price_35, category_id, subbrand_id")
  .in("code", codesToReactivate);
if (pe) {
  console.error("ERROR:", pe.message);
  process.exit(1);
}

console.log(`Productos encontrados para reactivar: ${(prods || []).length}\n`);
for (const p of (prods || []).sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(`${p.code} | ${p.name} | activo=${p.active} | cost=${p.cost} | pv=${p.pv} | cat=${p.category_id} | sub=${p.subbrand_id}`);
}

const found = new Set((prods || []).map(p => p.code));
const missingCodes = codesToReactivate.filter(c => !found.has(c));
if (missingCodes.length) console.log(`\n⚠️  No encontrados: ${missingCodes.join(", ")}`);

// Categorías
const { data: cats, error: ce } = await supabase.from("categories").select("id, name").order("name");
if (ce) console.log("ERROR cats:", ce.message);
else {
  console.log("\n=== CATEGORÍAS ===");
  for (const c of cats) console.log(`${c.id} | ${c.name}`);
}

const { data: subs, error: se } = await supabase.from("subcategories").select("id, name").order("name");
if (se) console.log("ERROR subs:", se.message);
else {
  console.log("\n=== SUBCATEGORÍAS ===");
  for (const s of subs) console.log(`${s.id} | ${s.name}`);
}

const { data: subs2, error: se2 } = await supabase.from("subbrands").select("id, name").order("name");
if (se2) console.log("ERROR subbrands:", se2.message);
else {
  console.log("\n=== SUBBRANDS ===");
  for (const s of subs2) console.log(`${s.id} | ${s.name}`);
}
