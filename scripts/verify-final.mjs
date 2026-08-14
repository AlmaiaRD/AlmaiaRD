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

const { data, error } = await supabase.from("products").select("code, name, active").in("code", ["A0244DR","E3878S","127833D","A4042","E0001"]);
if (error) { console.error(error.message); process.exit(1); }
for (const p of data) console.log(`${p.code} | ${p.name} | activo=${p.active}`);

const { data: total, error: te } = await supabase.from("products").select("id").eq("active", true);
if (te) { console.error(te.message); process.exit(1); }
console.log(`\n📦 Total de productos ACTIVOS: ${total.length}`);
