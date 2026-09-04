#!/usr/bin/env node
// Auditoría de integridad financiera - vía Management API (no depende de .env.local)
// Requiere la variable de entorno SUPABASE_ACCESS_TOKEN con un Personal Access Token válido.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("Falta variable de entorno SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const PROJECT_REF = "rexebvnzgnnrxhxmwayx";
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function q(sql) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(`SQL (${res.status}): ${e}`); }
  return res.json();
}

const checks = {
  "Invoices pagadas vs total recibos": `
    SELECT i.id, i.total,
      COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.invoice_id = i.id), 0) AS pagado,
      i.total - COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.invoice_id = i.id), 0) AS saldo
    FROM invoices i
    WHERE i.status = 'PAID'
      AND (i.total - COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.invoice_id = i.id), 0)) <> 0
    LIMIT 20;`,
  "Recibos sin factura válida (invoice_id no nulo pero sin match)": `
    SELECT r.id, r.invoice_id FROM receipts r
    WHERE r.invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = r.invoice_id)
    LIMIT 20;`,
  "Credit imbalances negativos": `
    SELECT id, client_id, amount, COALESCE(balance, amount) AS balance
    FROM credit_balances WHERE balance < 0 LIMIT 20;`,
  "Clientes con credit_balance negativo": `
    SELECT id, full_name, credit_balance FROM clients WHERE COALESCE(credit_balance,0) < 0 LIMIT 20;`,
  "Stock de inventario negativo": `
    SELECT product_id, stock FROM inventory WHERE stock < 0 LIMIT 20;`,
  "Facturas sin items": `
    SELECT i.id, i.invoice_number FROM invoices i
    WHERE NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id) LIMIT 20;`,
  "Facturas canceladas con recibos": `
    SELECT i.id, i.invoice_number, i.status FROM invoices i
    WHERE i.status IN ('CANCELLED','VOID')
      AND EXISTS (SELECT 1 FROM receipts r WHERE r.invoice_id = i.id) LIMIT 20;`,
  "Products sin categoria (activos)": `
    SELECT id, name FROM products WHERE active = true AND category_id IS NULL LIMIT 20;`,
  "Compras total vs purchase_items (mismatch)": `
    SELECT p.id, p.total,
      COALESCE((SELECT SUM(pi.line_total) FROM purchase_items pi WHERE pi.purchase_id = p.id),0) AS suma_items,
      p.total - COALESCE((SELECT SUM(pi.line_total) FROM purchase_items pi WHERE pi.purchase_id = p.id),0) AS diff
    FROM purchases p WHERE p.total IS NOT NULL
      AND p.total <> COALESCE((SELECT SUM(pi.line_total) FROM purchase_items pi WHERE pi.purchase_id = p.id),0)
    LIMIT 20;`,
  "Orphan invoice_items (sin factura padre)": `
    SELECT id, invoice_id FROM invoice_items WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id) LIMIT 20;`,
  "Orphan purchase_items (sin compra padre)": `
    SELECT id, purchase_id FROM purchase_items WHERE NOT EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_items.purchase_id) LIMIT 20;`,
  "Orphan receipts (client_id sin match)": `
    SELECT id FROM receipts WHERE client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = receipts.client_id) LIMIT 20;`,
  "Quotes expiradas sin convertir (estado PENDING antiguas)": `
    SELECT id, quote_number, status, created_at FROM quotes WHERE status = 'PENDING' ORDER BY created_at LIMIT 10;`,
};

let anyProblem = false;
for (const [name, sql] of Object.entries(checks)) {
  try {
    const rows = await q(sql);
    const n = Array.isArray(rows) ? rows.length : 0;
    console.log(`\n[${n > 0 ? "PROBLEMA" : "OK"}] ${name} (${n})`);
    if (n > 0) { anyProblem = true; console.log(JSON.stringify(rows, null, 1)); }
  } catch (e) {
    console.log(`\n[ERROR QUERY] ${name}: ${e.message}`);
  }
}

console.log(`\n=== ${anyProblem ? "SE DETECTARON PROBLEMAS" : "TODO OK EN CONSISTENCIA FINANCIERA"} ===`);
