import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validation";

const PROJECT_REF = "rexebvnzgnnrxhxmwayx";

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

const migratePostSchema = z.object({
  name: z.string().min(1).refine((v) => v in DEV_ONLY_MIGRATIONS, "Migración no permitida"),
});

async function assertAllowed(req: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible en producción" }, { status: 403 });
  }
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`migrate:${ip}`, 3, 60000);
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
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
  try {
    await validateBody(migratePostSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  try {
    const denied = await assertAllowed(req);
    if (denied) return denied;

    const { name } = await req.json();

    const result = await runSql(DEV_ONLY_MIGRATIONS[name]);
    return NextResponse.json({ ok: true, name, result });
  } catch {
    return NextResponse.json({ error: "Error al ejecutar migración" }, { status: 500 });
  }
}