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

function baseCode(code) {
  const m = (code || "").match(/^(\d{4,6})/);
  return m ? m[1] : code || "";
}

const reportFile = resolve(__dirname, "..", "amway-comparison-report.json");
const report = JSON.parse(readFileSync(reportFile, "utf-8"));

const { error: authError } = await supabase.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
});
if (authError) {
  console.error("ERROR auth:", authError.message);
  process.exit(1);
}

const { data: all, error: err } = await supabase.from("products").select("code, name, active");
if (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}

const allByCode = new Map();
for (const p of all) allByCode.set(p.code, p);

const byBase = new Map();
for (const p of all) {
  const base = baseCode(p.code);
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(p);
}

console.log(`Verificando ${report.missing_list.length} faltantes contra TODOS los productos Almaia (activos e inactivos)...\n`);

const trulyMissing = [];
for (const m of report.missing_list) {
  const exact = allByCode.get(m.amwayCode);
  const others = byBase.get(baseCode(m.amwayCode)) || [];
  if (exact) {
    console.log(`✅ ${m.amwayCode} | ${m.name} -> EXISTE en Almaia como "${exact.name}" (activo=${exact.active})`);
  } else if (others.length) {
    console.log(`⚠️  ${m.amwayCode} | ${m.name} -> mismo base que ${others.map(o => `${o.code} "${o.name}" (activo=${o.active})`).join(", ")}`);
  } else {
    console.log(`❌ ${m.amwayCode} | ${m.name} -> NO existe en Almaia`);
    trulyMissing.push(m);
  }
}

console.log(`\n=== RESUMEN ===`);
console.log(`Faltantes genuinos (no existen en Almaia): ${trulyMissing.length}`);
for (const m of trulyMissing) console.log(`   ${m.amwayCode} | ${m.name}`);
