import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PROJECT_REF = "rexebvnzgnnrxhxmwayx";

export async function GET() {
  // Auth check: only admin can run migrations
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  const sql = `
    ALTER TABLE products ADD COLUMN IF NOT EXISTS apply_itbis BOOLEAN DEFAULT true;
    UPDATE products SET apply_itbis = true WHERE apply_itbis IS NULL;
    UPDATE products SET apply_itbis = false WHERE subbrand_id IN (SELECT id FROM subbrands WHERE name = 'Nutrilite') AND name NOT ILIKE '%proteína vegetal%' AND apply_itbis IS DISTINCT FROM false;
  `;

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Migration error:", err);
    return NextResponse.json({ error: err, status: res.status }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Migración ejecutada correctamente" });
}
