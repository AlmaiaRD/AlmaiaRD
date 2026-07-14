import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

const PROJECT_REF = "rexebvnzgnnrxhxmwayx";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = checkRateLimit(`migrate:${ip}`, 3, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  const sql = `
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    AS $$ SELECT role FROM public.users WHERE id = auth.uid(); $$;
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

  return NextResponse.json({ ok: true, message: "Función get_user_role() creada correctamente" });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = checkRateLimit(`migrate:${ip}`, 3, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  const { sql } = await req.json();
  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "SQL es requerido" }, { status: 400 });
  }

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
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const result = await res.json();
  return NextResponse.json({ ok: true, result });
}
