import { NextRequest, NextResponse } from "next/server";
import { createTransport } from "nodemailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/services/settings";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = checkRateLimit(`send-email:${ip}`, 5, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { to, subject, body, attachment } = await req.json();

    const settings = await getSettings();

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
  } catch (err: any) {
    console.error("[send-email]", err);
    return NextResponse.json({ error: err?.message || "Error al enviar" }, { status: 500 });
  }
}
