import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { preferencesSchema, validateBody } from "@/lib/validation";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Error al cargar preferencias" }, { status: 500 });

  return NextResponse.json({ preferences: data?.preferences || {} });
}

export async function PATCH(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await validateBody(preferencesSchema)(req) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  // 1) Autenticar al usuario con su propia sesión (cookies + anon key).
  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) Leer y escribir con service role para NO depender de la política RLS de
  //    UPDATE sobre `users` (que puede faltar en el proyecto y provocaba que el
  //    guardado se descartara en silencio). El alcance se fija SIEMPRE al propio
  //    id del usuario autenticado y solo se modifica la columna `preferences`.
  const db = createClient(supabaseUrl, serviceRoleKey || anonKey);

  const { data: current, error: readError } = await db
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .single();
  if (readError) {
    return NextResponse.json({ error: "Error al cargar preferencias" }, { status: 500 });
  }

  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([k]) => !["__proto__", "constructor", "prototype"].includes(k))
  );
  const merged = { ...(current?.preferences as Record<string, unknown> || {}), ...sanitized };

  const { error } = await db
    .from("users")
    .update({ preferences: merged })
    .eq("id", user.id);

  if (error) {
    console.error("Error al guardar preferencias:", error.message);
    return NextResponse.json({ error: "Error al guardar preferencias" }, { status: 500 });
  }

  return NextResponse.json({ preferences: merged });
}