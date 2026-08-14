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

// Excepciones confirmadas por el usuario (mantienen ITBIS ON)
const EXCEPTIONS_ON = ["106542MX", "102736MX", "110415CO"]; // Cerocarb, Fibra, Proteína vegetal
// Todos los demás Nutrilite deben tener ITBIS OFF
const CODES_OFF = ["118761CN", "124692DR"]; // Vitamina D, Defensa inmunológica

let updated = 0;
for (const code of CODES_OFF) {
  const { data, error } = await supabase
    .from("products")
    .update({ apply_itbis: false })
    .eq("code", code)
    .select("code, name, apply_itbis");
  if (error) { console.log(`❌ ${code}: ${error.message}`); continue; }
  if (data?.length) { updated++; console.log(`✅ ${code} — ${data[0].name}: ITBIS → OFF`); }
  else console.log(`⚠️ ${code}: no encontrado`);
}

// Verificar estado final de todas las excepciones
console.log("\n=== Nutrilite con ITBIS ON (excepciones) ===");
const { data: prods } = await supabase
  .from("products")
  .select("code, name, apply_itbis, active, subbrands(name), categories(name)");
const isNutri = (p) => (p.subbrands?.name === "Nutrilite") || (p.categories?.name === "Salud") || /^Nutrilite/i.test(p.name || "");
const nutriWithItbis = (prods || []).filter((p) => p.apply_itbis && isNutri(p));
for (const p of nutriWithItbis) {
  const isException = EXCEPTIONS_ON.includes(p.code);
  console.log(`   ${p.code} ${isException ? "✅ excepción OK" : "⚠️ NO debería tener ITBIS"} — ${p.name}`);
}
const wrong = nutriWithItbis.filter((p) => !EXCEPTIONS_ON.includes(p.code));
console.log(`\nActualizados: ${updated} | Nutrilite con ITBIS: ${nutriWithItbis.length} | Incorrectos: ${wrong.length}`);
