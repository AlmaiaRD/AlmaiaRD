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
  .eq("category_id", "fdd1b7b3-55c1-4e12-9a73-ace06fd56b18")
  .eq("active", true);
if (error) { console.error(error.message); process.exit(1); }

console.log("Hogar activos:");
for (const p of data) console.log(`${p.code} | ${p.name} | cost=${p.cost} | pv=${p.pv} | p30=${p.price_30} | p35=${p.price_35} | itbis=${p.apply_itbis}`);
