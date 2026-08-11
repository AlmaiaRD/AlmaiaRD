import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

const PROJECT_REF = "rexebvnzgnnrxhxmwayx";

// Endpoint SOLO para desarrollo: ejecuta SQL con el token de administración de
// Supabase. En producción queda deshabilitado y NO acepta SQL arbitrario.
const DEV_ONLY_MIGRATIONS: Record<string, string> = {
  create_get_user_role: `
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    AS $$ SELECT role FROM public.users WHERE id = auth.uid(); $$;
  `,
};

async function assertAllowed(req: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible en producción" }, { status: 403 });
  }
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = checkRateLimit(`migrate:${ip}`, 3, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { data: userData } = await supabase.from("users").select("role").eq("id", session.user.id).single();
  if (userData?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado, se requiere rol admin" }, { status: 403 });
  }
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN no configurado" }, { status: 500 });
  }
  return null;
}

async function runSql(sql: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("Migration error:", err);
    throw new Error("Error al ejecutar migración");
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const denied = await assertAllowed(req);
    if (denied) return denied;
    const result = await runSql(DEV_ONLY_MIGRATIONS.create_get_user_role);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Error al ejecutar migración" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // No se acepta SQL arbitrario. Solo migraciones nombradas de la allowlist.
  try {
    const denied = await assertAllowed(req);
    if (denied) return denied;

    const { name } = await req.json();
    if (typeof name !== "string" || !DEV_ONLY_MIGRATIONS[name]) {
      return NextResponse.json(
        { error: "Migración no permitida. Usa un nombre de la allowlist." },
        { status: 400 }
      );
    }

    const result = await runSql(DEV_ONLY_MIGRATIONS[name]);
    return NextResponse.json({ ok: true, name, result });
  } catch {
    return NextResponse.json({ error: "Error al ejecutar migración" }, { status: 500 });
  }
}
