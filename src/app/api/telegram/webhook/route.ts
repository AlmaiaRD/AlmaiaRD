import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminClient = SupabaseClient;

function getAdminClient(): AdminClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// Telegram no usa HMAC: el update debe incluir el header autenticado por el
// bot (secret_token que registramos con setWebhook).
function verifySecretToken(
  header: string | null,
  configSecret: string | null | undefined
): boolean {
  if (!configSecret) {
    console.error("[telegram-webhook] webhook_secret no configurado; webhook rechazado");
    return false;
  }
  return header === configSecret;
}

async function processIncomingMessage(
  supabase: AdminClient | null,
  body: unknown,
  configId: string | null
) {
  const message = (body as { message?: { chat?: { id?: number | string }; text?: string; from?: { first_name?: string; last_name?: string; username?: string } } })?.message;
  const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
  const text = message?.text;
  if (!supabase || !chatId) {
    if (chatId) {
      console.error(`[telegram-webhook] (sin service role) mensaje de ${chatId}: ${text || "(no text)"}`);
    }
    return;
  }

  await supabase.from("telegram_logs").insert({
    config_id: configId,
    chat_id: chatId,
    direction: "incoming",
    message_type: "text",
    message_body: text,
    status: "received",
  });

  // Modelo B: vincular chat con un cliente si ya existe el chat_id en clients.
  const { data: existing } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existing) {
    // Cliente ya vinculado: solo registrar.
    if (text) {
      await supabase.from("telegram_logs").insert({
        config_id: configId,
        chat_id: chatId,
        direction: "outgoing",
        message_type: "text",
        message_body: `Hola ${existing.full_name}, recibimos tu mensaje.`,
        status: "sent",
      });
    }
    return;
  }

  // Primer contacto: registrar chat_id (aún sin cliente) y responder para
  // confirmar que el bot funciona y mostrar el chat_id vinculable.
  const reply =
    text && text.startsWith("/start")
      ? "¡Hola! Soy el asistente de Almaia RD. Tu chat_id de Telegram es " + chatId + ". Comparte este número con la administradora para recibir notificaciones."
      : "Gracias por escribir. Tu chat_id es " + chatId + ". Con este número quedará vinculado a tus notificaciones.";

  await supabase.from("telegram_logs").insert({
    config_id: configId,
    chat_id: chatId,
    direction: "outgoing",
    message_type: "text",
    message_body: reply,
    status: "sent",
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const body = JSON.parse(rawBody);

    const supabase = getAdminClient();
    if (!supabase) {
      return new NextResponse("No service role", { status: 500 });
    }

    // Identificamos la config activa (solo una se usa en producción).
    const { data: configs } = await supabase
      .from("telegram_configs")
      .select("id, webhook_secret")
      .eq("is_active", true)
      .limit(1);

    const config = configs?.[0];
    if (!config || !verifySecretToken(secretHeader, config.webhook_secret)) {
      return new NextResponse("Invalid secret token", { status: 401 });
    }

    await processIncomingMessage(supabase, body, config.id);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[telegram-webhook] error", error);
    return NextResponse.json({ status: "ok" });
  }
}