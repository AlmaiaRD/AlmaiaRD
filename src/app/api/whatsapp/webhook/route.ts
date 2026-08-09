import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET) {
    console.warn("WHATSAPP_APP_SECRET no configurado; webhook aceptado sin verificar");
    return true;
  }
  if (!signature) return false;

  const expected = createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
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

// POST - Receive messages
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify the webhook signature (HMAC-SHA256 of the raw body using the App Secret)
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    // Process each message
    for (const message of messages) {
      const from = message.from;
      const type = message.type;
      const text = message.text?.body;

      // Log the incoming message
      console.log(`WhatsApp message from ${from}: [${type}] ${text || "(media)"}`);

      // Here you can add custom logic:
      // - Store in database
      // - Trigger automations
      // - Send auto-replies
      // - Forward to CRM
    }

    // Always return 200 quickly
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Still return 200 to avoid retries
  }
}
