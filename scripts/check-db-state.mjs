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

// 1. Columnas de inventory (migración 20250717 añade pending_return)
const { data: inv, error: invErr } = await supabase.from("inventory").select("*").limit(1);
console.log("=== inventory (1 fila) ===");
console.log("error:", invErr?.message || "ninguno");
if (inv && inv.length) {
  console.log("columnas:", Object.keys(inv[0]).join(", "));
} else {
  console.log("(sin filas)");
}

// 2. Verificar que el trigger de precios funciona: crear producto temporal de prueba
//    usando un código único y luego borrarlo
const testCode = "ZZTEST" + Date.now();
const { data: prod, error: insErr } = await supabase
  .from("products")
  .insert({ code: testCode, name: "Producto Test Temporal", cost: 1000, active: true })
  .select()
  .single();
console.log("\n=== Test trigger trg_calculate_prices ===");
if (insErr) {
  console.log("insert error:", insErr.message);
} else {
  console.log(`insertado: ${prod.code} cost=${prod.cost}`);
  console.log(`price_30=${prod.price_30} (esperado 1300) | price_35=${prod.price_35} (esperado 1350) | trigger: ${prod.price_30 === 1300 && prod.price_35 === 1350 ? "✅ FUNCIONA" : "❌ NO FUNCIONA"}`);
  // Limpiar
  const { error: delErr } = await supabase.from("products").delete().eq("id", prod.id);
  console.log("limpieza:", delErr ? "❌ " + delErr.message : "✅ ok");
}

// 3. Verificar settings columns (phase5)
const { data: settings, error: setErr } = await supabase.from("settings").select("*").limit(1);
console.log("\n=== settings (1 fila) ===");
console.log("error:", setErr?.message || "ninguno");
if (settings && settings.length) {
  console.log("columnas:", Object.keys(settings[0]).join(", "));
}

// 4. Verificar tabla return_items (migración 20250713_returns)
const { data: ret, error: retErr } = await supabase.from("return_items").select("*").limit(1);
console.log("\n=== return_items ===");
console.log("error:", retErr?.message || "ninguno", "| count:", ret?.length ?? 0);

// 5. Verificar credit_balances
const { data: cred, error: credErr } = await supabase.from("credit_balances").select("*").limit(1);
console.log("\n=== credit_balances ===");
console.log("error:", credErr?.message || "ninguno", "| count:", cred?.length ?? 0);
