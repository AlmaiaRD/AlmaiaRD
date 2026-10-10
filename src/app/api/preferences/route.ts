import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    .maybeSingle();

  if (error) {
    console.error("Error al cargar preferencias:", error.message, error.code);
    return NextResponse.json({ error: "Error al cargar preferencias" }, { status: 500 });
  }

  return NextResponse.json({ preferences: (data?.preferences as Record<string, unknown>) || {} });
}

/**
 * Guarda preferencias del usuario autenticado.
 *
 * IMPORTANTE: la tabla `public.users` no tiene política RLS de UPDATE, por lo
 * que un UPDATE hecho con la sesión del usuario es descartado en silencio (0
 * filas). Por eso la escritura se hace con **service role** (que omite RLS),
 * con el alcance fijado SIEMPRE al propio id del usuario y solo la columna
 * `preferences`.
 *
 * Además se VERIFICA que la escritura haya afectado al menos una fila; si no,
 * se intenta con la sesión del usuario (por si en el futuro se añade la
 * política RLS) y, si tampoco, se devuelve un error explícito en lugar de un
 * falso "guardado correcto".
 */
export async function PATCH(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await validateBody(preferencesSchema)(req)) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validación fallida" },
      { status: 400 }
    );
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

  // 2) Cliente con service role (omite RLS) para leer/escribir. Si la clave no
  //    estuviera disponible, se usa el cliente autenticado como respaldo.
  let serviceDb: SupabaseClient | null = null;
  if (serviceRoleKey) {
    serviceDb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  }

  // 2.a) Leer preferencias actuales (service role primero; si no, sesión propia).
  let current: Record<string, unknown> = {};
  let readVia = "auth";
  if (serviceDb) {
    const { data, error } = await serviceDb
      .from("users")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();
    if (!error) {
      current = (data?.preferences as Record<string, unknown>) || {};
      readVia = "service";
    } else {
      console.error("Leyendo preferencias con service role falló:", error.message, error.code);
    }
  }
  if (readVia !== "service") {
    const { data, error } = await authClient
      .from("users")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Error al cargar preferencias:", error.message, error.code);
      return NextResponse.json({ error: "Error al cargar preferencias" }, { status: 500 });
    }
    current = (data?.preferences as Record<string, unknown>) || {};
  }

  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([k]) => !["__proto__", "constructor", "prototype"].includes(k))
  );
  const merged = { ...current, ...sanitized };

  // 3) Escribir y VERIFICAR que la fila se actualizó realmente.
  let updatedRows = 0;
  if (serviceDb) {
    const { data, error } = await serviceDb
      .from("users")
      .update({ preferences: merged })
      .eq("id", user.id)
      .select("id");
    if (error) {
      console.error("Error al guardar preferencias (service role):", error.message, error.code);
    } else {
      updatedRows = data?.length ?? 0;
    }
  }

  if (updatedRows === 0) {
    // Respaldo con la sesión del usuario (funciona si la política RLS existe).
    const { data, error } = await authClient
      .from("users")
      .update({ preferences: merged })
      .eq("id", user.id)
      .select("id");
    if (error) {
      console.error("Error al guardar preferencias (sesión):", error.message, error.code);
    } else {
      updatedRows = data?.length ?? 0;
    }
  }

  if (updatedRows === 0) {
    console.error("No se pudo guardar preferencias: 0 filas actualizadas para", user.id);
    return NextResponse.json(
      { error: "No se pudieron guardar las preferencias" },
      { status: 500 }
    );
  }

  return NextResponse.json({ preferences: merged });
}
