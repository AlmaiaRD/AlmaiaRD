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
  .select("code, name, cost, pv, price_30, price_35, apply_itbis")
  .eq("subbrand_id", "2a0818d6-0d36-4d3b-8c47-55dfdc96af32")
  .eq("active", true)
  .order("code");
if (error) { console.error(error.message); process.exit(1); }

console.log("Nutrilite activos — cost/pv/precios:");
for (const p of data) {
  const r30 = p.cost ? Math.round(p.cost * 1.3 * 100) / 100 : 0;
  const r35 = p.cost ? Math.round(p.cost * 1.35 * 100) / 100 : 0;
  const flag30 = p.price_30 === r30 ? "=" : ` (formula: ${r30})`;
  const flag35 = p.price_35 === r35 ? "=" : ` (formula: ${r35})`;
  console.log(`${p.code} | cost=${p.cost} | pv=${p.pv} | p30=${p.price_30}${flag30} | p35=${p.price_35}${flag35} | itbis=${p.apply_itbis}`);
}
