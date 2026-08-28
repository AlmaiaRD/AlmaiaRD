import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { adminCredentials } from "file:///C:/Users/soporte/Desktop/AMWAY/AlmaiaRD-Web/scripts/_auth.mjs";
const creds = adminCredentials();
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync("file:///C:/Users/soporte/Desktop/AMWAY/AlmaiaRD-Web/.env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: ae } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
if (ae) { console.log("auth err", ae.message); process.exit(1); }
const { data, error } = await supabase.from("products").select("code,name,description,benefits").limit(6);
if (error) { console.log("err", error.message); process.exit(1); }
console.log("total returned:", data.length);
for (const p of data) {
  console.log("=====", p.code, "|", p.name);
  console.log("DESC:", (p.description || "").slice(0, 140).replace(/\n/g, " / "));
  console.log("BEN:", (p.benefits || "").slice(0, 140).replace(/\n/g, " / "));
}

