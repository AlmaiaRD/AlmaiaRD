import { NextRequest, NextResponse } from "next/server";
import { createTransport } from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, smtp, attachment } = await req.json();

    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return NextResponse.json(
        { error: "SMTP no configurado. Ve a Configuración e ingresa los datos de tu servidor SMTP." },
        { status: 400 }
      );
    }

    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure || false,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const mailOptions: any = {
      from: `"${smtp.senderName || smtp.user}" <${smtp.user}>`,
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
