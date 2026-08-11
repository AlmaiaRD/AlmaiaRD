// Genera supabase/migrations/0000_init_schema.sql desde la BD viva (Management API).
// Uso: SUPABASE_TOKEN=$(cat ~/.supabase/access-token) node scripts/dump-live-schema.mjs
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REF = process.env.SUPABASE_PROJECT_REF || "rexebvnzgnnrxhxmwayx";
const TOKEN = readFileSync(join(process.env.HOME, ".supabase", "access-token"), "utf-8").trim();

async function q(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

const esc = (s) => String(s ?? "").replace(/'/g, "''");

function buildColumnDefs(rows) {
  const byTable = new Map();
  for (const r of rows) {
    if (!byTable.has(r.relname)) byTable.set(r.relname, []);
    byTable.get(r.relname).push(r);
  }
  const out = {};
  for (const [table, cols] of byTable) {
    const defs = cols.map((c) => {
      let line = `    ${c.attname} ${c.data_type}`;
      if (c.default_value) line += ` DEFAULT ${c.default_value}`;
      if (!c.nullable) line += " NOT NULL";
      return line;
    });
    out[table] = defs.join(",\n");
  }
  return out;
}

const sql = [];
sql.push("-- ============================================================");
sql.push("-- ALMAIA RD - Esquema base (baseline autogenerado de la BD viva)");
sql.push(`-- Generado: ${new Date().toISOString()}`);
sql.push("-- NO editar manualmente; regenerar con scripts/dump-live-schema.mjs");
sql.push("-- ============================================================");
sql.push("");

// 1. Enum types
try {
  const enums = await q(`SELECT t.typname, e.enumlabel
    FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
    JOIN pg_namespace n ON t.typnamespace=n.oid
    WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder`);
  const enumMap = new Map();
  for (const e of enums) {
    if (!enumMap.has(e.typname)) enumMap.set(e.typname, []);
    enumMap.get(e.typname).push(e.enumlabel);
  }
  for (const [name, labels] of enumMap) {
    sql.push(`CREATE TYPE ${name} AS ENUM (${labels.map((l) => `'${esc(l)}'`).join(", ")});`);
  }
  if (enumMap.size) sql.push("");
} catch (e) { console.warn("[enums]", e.message); }

// 2. Tables
const tables = await q(`SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT LIKE '\\_%'
  ORDER BY c.relname`);

const columns = await q(`SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS data_type,
    NOT a.attnotnull AS nullable, COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS default_value
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname='public' AND c.relkind='r' AND a.attnum > 0 AND NOT a.attisdropped
    AND c.relname NOT LIKE '\\_%'
  ORDER BY c.relname, a.attnum`);
const colDefs = buildColumnDefs(columns);

const constraints = await q(`SELECT c.relname AS table_name, con.conname, con.contype,
    pg_get_constraintdef(con.oid) AS def, con.condeferrable, con.condeferred
  FROM pg_constraint con
  JOIN pg_class c ON con.conrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE con.contype IN ('p','u','f','c') AND n.nspname='public'
  ORDER BY c.relname, con.contype, con.conname`);

for (const t of tables) {
  sql.push(`CREATE TABLE IF NOT EXISTS public.${t.relname} (`);
  sql.push(colDefs[t.relname] || "    id uuid PRIMARY KEY DEFAULT gen_random_uuid()");
  sql.push(");");
  sql.push("");
}

// 3. Constraints (PK, UNIQUE, FK, CHECK)
for (const c of constraints) {
  const deferrable = c.condeferrable ? " DEFERRABLE" : "";
  const deferred = c.condeferred ? " INITIALLY DEFERRED" : "";
  sql.push(`ALTER TABLE ONLY public.${c.table_name} ADD CONSTRAINT ${c.conname} ${c.def}${deferrable}${deferred};`);
}
if (constraints.length) sql.push("");

// 4. Indexes (no PK)
const indexes = await q(`SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE '\\_%'
  ORDER BY tablename, indexname`);
for (const ix of indexes) {
  sql.push(`${ix.indexdef.replace(/CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ")};`);
}
if (indexes.length) sql.push("");

// 5. Views
const views = await q(`SELECT c.relname, pg_get_viewdef(c.oid) AS def
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v' ORDER BY c.relname`);
for (const v of views) {
  sql.push(`CREATE OR REPLACE VIEW public.${v.relname} AS ${v.def.trim()};`);
  sql.push("");
}

// 6. Functions (app RPCs; excluye auditoría interna de supabase_functions)
const funcs = await q(`SELECT p.proname, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind IN ('f','p')
  ORDER BY p.proname`);
for (const f of funcs) {
  sql.push(f.def.trim() + ";");
  sql.push("");
}

// 7. Triggers
const triggers = await q(`SELECT pg_get_triggerdef(t.oid, true) AS def
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid=c.oid
  JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE NOT t.tgisinternal AND n.nspname='public'
  ORDER BY c.relname`);
for (const t of triggers) sql.push(`${t.def.trim()};`);
if (triggers.length) sql.push("");

// 8. RLS: enable + policies
const rls = await q(`SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`);
for (const r of rls) {
  if (r.relrowsecurity) sql.push(`ALTER TABLE public.${r.relname} ENABLE ROW LEVEL SECURITY;`);
}
const policies = await q(`SELECT tablename, policyname, permissive, cmd, roles, qual, with_check
  FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`);
for (const p of policies) {
  const roles = p.roles === "{default}" ? "public" : p.roles.replace(/[{}]/g, "").split(",").join(", ");
  const using = p.qual ? ` USING (${p.qual})` : "";
  const check = p.with_check ? ` WITH CHECK (${p.with_check})` : "";
  const cmdStr = p.cmd === "ALL" ? "" : ` FOR ${p.cmd}`;
  sql.push(`CREATE POLICY "${p.policyname}" ON public.${p.tablename}${cmdStr}${p.permissive === "RESTRICTIVE" ? " AS RESTRICTIVE" : ""} TO ${roles}${using}${check};`);
}
if (policies.length) sql.push("");

// 9. Grants
const grants = await q(`SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
  ORDER BY table_name, grantee, privilege_type`);
const grantMap = new Map();
for (const g of grants) {
  const key = `${g.table_name}|${g.grantee}`;
  if (!grantMap.has(key)) grantMap.set(key, []);
  grantMap.get(key).push(g.privilege_type);
}
for (const [key, privs] of grantMap) {
  const [table, grantee] = key.split("|");
  sql.push(`GRANT ${privs.join(", ")} ON public.${table} TO ${grantee};`);
}

mkdirSync(join(ROOT, "supabase", "migrations"), { recursive: true });
const outPath = join(ROOT, "supabase", "migrations", "0000_init_schema.sql");
writeFileSync(outPath, sql.join("\n"));
console.log(`OK -> ${outPath} (${sql.length} líneas)`);
