import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { whatsappSendSchema, validateBody } from "@/lib/validation";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export async function POST(req: NextRequest) {
  try {
    await validateBody(whatsappSendSchema)(req);
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
  const limit = await checkRateLimit(`whatsapp-send:${ip}`, 20, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { configId, to, type, text, template } = await req.json();
    if (!configId || !to || !type) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // La lectura de whatsapp_configs está restringida por RLS a SOLO admin,
    // por lo que el access_token nunca sale del servidor y solo un admin
    // puede enviar mensajes.
    const { data: config, error: configError } = await authSupabase
      .from("whatsapp_configs")
      .select("*")
      .eq("id", configId)
      .single();
    if (configError || !config?.access_token || !config?.phone_number_id) {
      return NextResponse.json(
        { error: "No autorizado para leer la configuración de WhatsApp. Solo el administrador puede enviar mensajes." },
        { status: 403 }
      );
    }

    const message: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
    };
    if (type === "template" && template) {
      message.type = "template";
      message.template = template;
    } else {
      message.type = "text";
      message.text = { body: text ?? "" };
    }

    const response = await fetch(`${WHATSAPP_API_URL}/${config.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const data = await response.json().catch(() => ({}));

    const status = response.ok ? "sent" : "failed";
    try {
      await authSupabase.from("whatsapp_logs").insert({
        config_id: configId,
        recipient: to,
        message_type: type,
        template_name: type === "template" ? template?.name : undefined,
        status,
        message_id: data.messages?.[0]?.id,
        error: response.ok ? undefined : data.error?.message,
      });
    } catch (err) {
      console.error("[whatsapp-send] log error", err);
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error?.message || "Error al enviar el mensaje" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id });
  } catch {
    console.error("[whatsapp-send] error");
    return NextResponse.json({ error: "Error al enviar el mensaje de WhatsApp" }, { status: 500 });
  }
}