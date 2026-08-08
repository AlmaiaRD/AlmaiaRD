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

async function col(table, limit = 1) {
  const { data, error } = await supabase.from(table).select("*").limit(limit);
  if (error) return { exists: false, error: error.message };
  return { exists: true, columns: data.length ? Object.keys(data[0]).sort() : [] };
}

for (const [label, table] of [
  ["users (preferences)", "users"],
  ["whatsapp_configs", "whatsapp_configs"],
  ["followups", "followups"],
  ["communications", "communications"],
  ["inventory_movements", "inventory_movements"],
  ["invoice_items", "invoice_items"],
  ["purchase_items", "purchase_items"],
  ["categories", "categories"],
  ["subbrands", "subbrands"],
]) {
  const r = await col(table);
  if (!r.exists) console.log(`❌ ${label}: NO EXISTE (${r.error?.substring(0, 80)})`);
  else console.log(`✅ ${label}: ${r.columns.length} cols — ${r.columns.join(", ")}`);
}

// Verificar si whatsapp_configs.id tiene NOT NULL (migración performance)
const { data: wc, error: wcErr } = await supabase.from("whatsapp_configs").select("id").limit(1);
console.log(`\nwhatsapp_configs select: ${wcErr ? "❌ " + wcErr.message : "✅ ok"}`);
