import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminClient = any;

// El webhook no tiene sesión de usuario: se persiste con service role
// cuando está configurado; si no, se omite la escritura a BD sin fallar.
function getAdminClient(): AdminClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET) {
    console.error("WHATSAPP_APP_SECRET no configurado; webhook rechazado");
    return false;
  }
  if (!signature) return false;

  const expected = createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Actualiza el estado (sent/delivered/read) de un mensaje enviado.
async function processStatus(supabase: AdminClient | null, status: any) {
  const messageId = status?.id;
  const state = status?.status; // sent | delivered | read | failed
  if (!messageId || !state || !supabase) return;

  const { error } = await supabase
    .from("whatsapp_logs")
    .update({ status: state, status_updated_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .eq("direction", "outgoing");

  if (error) console.error(`[whatsapp-webhook] error actualizando estado ${messageId}:`, error.message);
}

// Persiste un mensaje entrante del cliente.
async function processIncomingMessage(supabase: AdminClient | null, message: any) {
  const from = message?.from;
  const type = message?.type;
  const text = message?.text?.body;

  if (!supabase) {
    console.error(`[whatsapp-webhook] (sin service role) mensaje de ${from}: ${text || "(media)"}`);
    return;
  }

  const { error } = await supabase.from("whatsapp_logs").insert({
    config_id: null,
    recipient: from,
    message_type: type || "unknown",
    status: "received",
    message_id: message?.id,
    direction: "incoming",
    message_body: text,
  });

  if (error) console.error(`[whatsapp-webhook] error guardando mensaje entrante de ${from}:`, error.message);
}

// GET - Webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// POST - Receive messages and status updates
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify the webhook signature (HMAC-SHA256 of the raw body using the App Secret)
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = getAdminClient();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    if (statuses && statuses.length > 0) {
      for (const status of statuses) {
        await processStatus(supabase, status);
      }
    }

    if (messages && messages.length > 0) {
      for (const message of messages) {
        await processIncomingMessage(supabase, message);
      }
    }

    // Always return 200 quickly
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Still return 200 to avoid retries
  }
}
