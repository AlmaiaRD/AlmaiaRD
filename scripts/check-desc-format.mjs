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

const { data, error } = await supabase
  .from("products")
  .select("code, name, description, benefits, subcategory, category_id, subbrand_id")
  .in("code", ["A4300DR", "123364DR"]);
if (error) { console.error(error.message); process.exit(1); }

for (const p of data) {
  console.log("======== " + p.code + " | " + p.name + " ========");
  console.log("subcategory:", p.subcategory, "| cat:", p.category_id, "| subbrand:", p.subbrand_id);
  console.log("--- DESCRIPTION (primeros 2500) ---");
  console.log(p.description ? p.description.substring(0, 2500) : "(vacía)");
  console.log("--- BENEFITS (primeros 1200) ---");
  console.log(p.benefits ? p.benefits.substring(0, 1200) : "(vacía)");
  console.log("\n");
}
