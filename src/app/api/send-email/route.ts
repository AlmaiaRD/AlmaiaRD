import { NextRequest, NextResponse } from "next/server";
import { createTransport } from "nodemailer";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/services/settings";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const authSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();
  if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`send-email:${ip}`, 5, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { to, subject, body, attachment } = await req.json();

    const settings = await getSettings(false, { includeSecrets: true, client: authSupabase });

    if (!settings) {
      return NextResponse.json(
        { error: "No autorizado para leer la configuración SMTP. Solo el administrador puede enviar correos." },
        { status: 403 }
      );
    }

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return NextResponse.json(
        { error: "SMTP no configurado. Ve a Configuración e ingresa los datos de tu servidor SMTP." },
        { status: 400 }
      );
    }

    const transporter = createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: settings.smtp_secure || false,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });

    const mailOptions: any = {
      from: `"${settings.sender_name || settings.smtp_user}" <${settings.smtp_user}>`,
      to,
      subject,
      text: body,
    };

    if (attachment?.base64 && attachment?.filename) {
      mailOptions.attachments = [
        {
          filename: attachment.filename,
          content: attachment.base64,
          encoding: "base64",
        },
      ];
    }

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch {
    console.error("[send-email] error");
    return NextResponse.json({ error: "Error al enviar el correo. Verifica la configuración SMTP." }, { status: 500 });
  }
}
