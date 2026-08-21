import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const authSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const configId = searchParams.get("configId");
  if (!configId) {
    return NextResponse.json({ error: "configId requerido" }, { status: 400 });
  }

  try {
    // RLS restringe whatsapp_configs a SOLO admin: el token no sale del servidor.
    const { data: config, error: configError } = await authSupabase
      .from("whatsapp_configs")
      .select("*")
      .eq("id", configId)
      .single();
    if (configError || !config?.access_token || !config?.business_account_id) {
      return NextResponse.json(
        { error: "No autorizado. Solo el administrador puede ver las plantillas de Meta." },
        { status: 403 }
      );
    }

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.business_account_id}/message_templates`,
      { headers: { Authorization: `Bearer ${config.access_token}` } }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data.data || []);
  } catch {
    console.error("[whatsapp-templates] error");
    return NextResponse.json({ error: "Error al cargar las plantillas de Meta" }, { status: 500 });
  }
}
