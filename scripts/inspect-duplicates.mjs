#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

import { adminCredentials } from "./_auth.mjs";
const creds = adminCredentials();
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    console.error("ERROR: No se encuentra .env.local");
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
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
  email: creds.email,
  password: creds.password,
});
if (authError) {
  console.error("ERROR autenticación:", authError.message);
  process.exit(1);
}
console.log("✅ Autenticado como admin");

const { data: products, error } = await supabase
  .from("products")
  .select("id, code, name, active, cost, pv, created_at, updated_at");
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

const active = (products || []).filter(p => p.active);

function normalizeName(n) {
  return (n || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9áéíóúñü ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byName = {};
for (const p of active) {
  const key = normalizeName(p.name);
  if (!key) continue;
  if (!byName[key]) byName[key] = [];
  byName[key].push(p);
}

console.log("\n=== DUPLICADOS CON CREATED/UPDATE ===");
let count = 0;
for (const key of Object.keys(byName)) {
  if (byName[key].length > 1) {
    count++;
    console.log(`\n${count}. "${key}"`);
    for (const p of byName[key].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
      console.log(`   ${p.code} | created=${p.created_at} | updated=${p.updated_at}`);
    }
  }
}
console.log(`\nTotal grupos duplicados: ${count}`);
