import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "almaia-verify-token";

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
    const body = await req.json();

    // Verify the webhook signature (optional but recommended)
    // const signature = req.headers.get("x-hub-signature-256");

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
