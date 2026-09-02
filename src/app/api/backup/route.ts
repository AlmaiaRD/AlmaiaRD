import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { backupSchema, validateBody } from "@/lib/validation";

const EXCLUDE_TABLES = new Set(["_prisma_migrations"]);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await validateBody(backupSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Backup no configurado" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit(`backup:${ip}`, 2, 60000);
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });
  }

  // Verify auth + admin role
  const cookieStore = await cookies();
  const authSupabase = createServerClient(supabaseUrl, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data: userData } = await authSupabase.from("users").select("role").eq("id", user.id).single();
  if (userData?.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const key = serviceRoleKey || anonKey;
  const supabase = createClient(supabaseUrl, key);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (!res.ok) throw new Error(`Error fetching schema: ${res.status}`);
    const spec = await res.json();
    const definitions = spec?.definitions ?? spec?.components?.schemas ?? {};
    const tables = Object.keys(definitions).filter((k) => !k.startsWith("vw_") && !EXCLUDE_TABLES.has(k));

    const date = new Date().toISOString().split("T")[0];
    const backupName = `backup-${date}`;
    const backupData: Record<string, any[]> = {};

    for (const table of tables) {
      try {
        const { data } = await supabase.from(table).select("*").limit(100000);
        backupData[table] = data || [];
      } catch {
        backupData[table] = [];
      }
    }

    const manifest = {
      backup_name: backupName,
      created_at: new Date().toISOString(),
      table_count: tables.length,
      total_rows: Object.values(backupData).reduce((s, r) => s + r.length, 0),
    };
    const payload = JSON.stringify({ manifest, data: backupData }, null, 2);

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(`${backupName}.json`, payload, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

    return NextResponse.json({
      ok: true,
      backup: backupName,
      tables: tables.length,
      rows: manifest.total_rows,
      size_mb: (payload.length / 1024 / 1024).toFixed(2),
    });
  } catch {
    return NextResponse.json({ error: "Error al crear el respaldo" }, { status: 500 });
  }
}