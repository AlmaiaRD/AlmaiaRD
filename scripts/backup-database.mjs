import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import ws from "ws";

const env = {};
for (const line of readFileSync("./.env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  realtime: { transport: ws }, auth: { persistSession: false },
});

const { data: session, error: ae } = await supabase.auth.signInWithPassword({
  email: "admin@almaia.com", password: "Admin123!",
});
if (ae) { console.error("AUTH ERROR:", ae.message); process.exit(1); }
console.log("Autenticado como admin@almaia.com");

const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const DIR = join("backups", `almaia-backup-${STAMP}`);
mkdirSync(join(DIR, "tables"), { recursive: true });

const TABLES = [
  "categories", "subbrands", "users", "clients", "client_tags",
  "client_tag_relations", "products", "inventory", "inventory_movements",
  "suppliers", "purchases", "purchase_items", "bank_accounts", "invoices",
  "invoice_items", "receipts", "credit_balances", "followups", "expenses",
  "bonuses", "settings", "audit_logs", "communications",
];

const summary = {};
let ok = 0, fail = 0;
for (const t of TABLES) {
  const { data, error, count } = await supabase
    .from(t)
    .select("*", { count: "exact" });
  if (error) {
    summary[t] = { rows: null, error: error.message, file: null };
    fail++;
    console.log(`✗ ${t}: ${error.message}`);
    continue;
  }
  writeFileSync(join(DIR, "tables", `${t}.json`), JSON.stringify(data, null, 2));
  summary[t] = { rows: (data || []).length, file: `tables/${t}.json` };
  ok++;
  console.log(`✓ ${t}: ${(data || []).length} filas`);
}

writeFileSync(
  join(DIR, "dump-summary.json"),
  JSON.stringify({
    exported_at: new Date().toISOString(),
    by: "admin@almaia.com",
    environment: env.NEXT_PUBLIC_SUPABASE_URL,
    tables_total: TABLES.length,
    tables_ok: ok,
    tables_failed: fail,
    tables: summary,
  }, null, 2)
);

console.log(`\nResumen: ${ok}/${TABLES.length} tablas exportadas, ${fail} con error`);
console.log(`Backup BD en: ${DIR}`);
