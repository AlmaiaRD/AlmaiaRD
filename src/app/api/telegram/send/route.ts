import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { telegramSendSchema, validateBody } from "@/lib/validation";

const TELEGRAM_API_URL = "https://api.telegram.org";

export async function POST(req: NextRequest) {
  try {
    await validateBody(telegramSendSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

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
  const limit = await checkRateLimit(`telegram-send:${ip}`, 30, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { configId, chatId, text } = await req.json();
    if (!configId || !chatId || !text) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // La lectura de telegram_configs está restringida por RLS a SOLO admin,
    // por lo que el bot_token nunca sale del servidor y solo un admin
    // puede enviar mensajes.
    const { data: config, error: configError } = await authSupabase
      .from("telegram_configs")
      .select("*")
      .eq("id", configId)
      .single();
    if (configError || !config?.bot_token) {
      return NextResponse.json(
        { error: "No autorizado para leer la configuración de Telegram. Solo el administrador puede enviar mensajes." },
        { status: 403 }
      );
    }

    const response = await fetch(`${TELEGRAM_API_URL}/bot${config.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await response.json().catch(() => ({}));

    const status = response.ok ? "sent" : "failed";
    try {
      await authSupabase.from("telegram_logs").insert({
        config_id: configId,
        chat_id: chatId,
        direction: "outgoing",
        message_type: "text",
        message_body: text,
        status,
        message_id: response.ok ? data.result?.message_id : undefined,
        error: response.ok ? undefined : data.description,
      });
    } catch (err) {
      console.error("[telegram-send] log error", err);
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.description || "Error al enviar el mensaje" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, messageId: data.result?.message_id });
  } catch {
    console.error("[telegram-send] error");
    return NextResponse.json({ error: "Error al enviar el mensaje de Telegram" }, { status: 500 });
  }
}