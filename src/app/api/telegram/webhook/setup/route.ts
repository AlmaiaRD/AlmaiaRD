import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

const TELEGRAM_API_URL = "https://api.telegram.org";

export async function POST(req: NextRequest) {
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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`telegram-webhook-setup:${ip}`, 10, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { configId, webhookUrl } = await req.json();
    if (!configId || !webhookUrl) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // RLS admin-only: el bot_token nunca sale del servidor.
    const { data: config, error: configError } = await authSupabase
      .from("telegram_configs")
      .select("*")
      .eq("id", configId)
      .single();
    if (configError || !config?.bot_token) {
      return NextResponse.json(
        { error: "No autorizado. Solo el administrador puede configurar el webhook." },
        { status: 403 }
      );
    }

    // Secret token propio para que Telegram lo envíe en cada update
    // (autenticación del webhook; no existe HMAC como en WhatsApp).
    const secretToken = config.webhook_secret || crypto.randomUUID().replace(/-/g, "");
    const url = new URL(webhookUrl);
    if (url.pathname === "/") {
      url.pathname = "/api/telegram/webhook";
    }
    const webhook = url.toString();

    const response = await fetch(`${TELEGRAM_API_URL}/bot${config.bot_token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhook,
        secret_token: secretToken,
        allowed_updates: ["message"],
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        { success: false, error: data.description || "Error al registrar el webhook" },
        { status: 400 }
      );
    }

    await authSupabase.from("telegram_configs").update({ webhook_secret: secretToken }).eq("id", configId);

    return NextResponse.json({ success: true, webhook, secretToken });
  } catch (error) {
    console.error("[telegram-webhook-setup] error", error);
    return NextResponse.json({ error: "Error al configurar el webhook" }, { status: 500 });
  }
}