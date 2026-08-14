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

const { data, error } = await supabase
  .from("products")
  .select("code, name, subcategory, category_id, subbrand_id")
  .eq("active", true);
if (error) { console.error(error.message); process.exit(1); }

console.log("=== SUBCATEGORÍA por categoría (activos) ===");
const byCat = {};
for (const p of data) {
  const key = p.category_id || "null";
  if (!byCat[key]) byCat[key] = new Set();
  if (p.subcategory) byCat[key].add(p.subcategory);
}
for (const [cat, set] of Object.entries(byCat)) {
  console.log(`cat=${cat}: ${[...set].sort().join(" | ")}`);
}

console.log("\n=== Productos Hogar (fdd1b7b3) ===");
for (const p of data.filter(x => x.category_id === "fdd1b7b3-55c1-4e12-9a73-ace06fd56b18")) {
  console.log(`${p.code} | ${p.name} | subcat=${p.subcategory}`);
}

console.log("\n=== Productos Salud/Vitaminas con subcategory != null ===");
for (const p of data.filter(x => (x.category_id === "cd6804dc-73cb-4234-a596-6b4b32fe6b98" || x.category_id === "a4a0cb06-0684-4a88-980d-37dcfaf569a7") && p.subcategory)) {
  console.log(`${p.code} | ${p.name} | subcat=${p.subcategory}`);
}
