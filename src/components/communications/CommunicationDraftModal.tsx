"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Send } from "lucide-react";
import { generateEmailDraft, generateWhatsAppDraft, createCommunication } from "@/services/communications";
import toast from "react-hot-toast";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  senderName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "email" | "whatsapp";
  client: { id: string; full_name: string; email?: string; phone?: string };
  documentType: "invoice" | "receipt";
  documentNumber: string;
  documentId: string;
  total: string;
  businessName: string;
  senderEmail?: string;
  senderName?: string;
  emailTemplate?: string;
  whatsappTemplate?: string;
  smtp?: SmtpConfig;
  getAttachment?: () => Promise<{ filename: string; base64: string }>;
  onSaved?: () => void;
}

export default function CommunicationDraftModal({
  isOpen, onClose, type, client, documentType, documentNumber, documentId,
  total, businessName, senderEmail, senderName, emailTemplate, whatsappTemplate,
  smtp, getAttachment, onSaved,
}: Props) {
  const isEmail = type === "email";
  const [subject, setSubject] = useState(() => {
    if (!isEmail) return "";
    return generateEmailDraft({
      clientName: client.full_name,
      clientEmail: client.email || "",
      documentType,
      documentNumber,
      businessName,
      senderEmail,
      senderName,
      template: emailTemplate,
    }).subject;
  });
  const [body, setBody] = useState(() => {
    if (isEmail) {
      return generateEmailDraft({
        clientName: client.full_name, clientEmail: client.email || "",
        documentType, documentNumber, businessName, senderEmail, senderName,
        template: emailTemplate,
      }).body;
    }
    return generateWhatsAppDraft({
      clientName: client.full_name, documentType, documentNumber, total, businessName,
      template: whatsappTemplate,
    }).text;
  });
  const [saving, setSaving] = useState(false);
  const smtpOk = isEmail && smtp?.host && smtp?.user && smtp?.pass;

  async function handleSave(status: "draft" | "sent" = "draft") {
    setSaving(true);
    try {
      let attachment: { filename: string; base64: string } | undefined;
      if (status === "sent" && isEmail && smtpOk) {
        if (getAttachment) attachment = await getAttachment();
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: client.email,
            subject,
            body,
            smtp: { ...smtp, senderName: senderName || businessName },
            attachment,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al enviar");
        }
      }

      const commStatus = (isEmail && status === "sent") ? "sent" : "draft";
      const comm = await createCommunication({
        client_id: client.id,
        type,
        subject: isEmail ? subject : undefined,
        body,
        document_type: documentType,
        document_id: documentId,
        status: commStatus,
        sent_at: commStatus === "sent" ? new Date().toISOString() : undefined,
      });

      if (commStatus === "sent") {
        toast.success(`${isEmail ? "Email" : "WhatsApp"} enviado`);
      } else {
        toast.success(`Borrador de ${isEmail ? "email" : "WhatsApp"} guardado`);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar borrador");
    }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`Preparar ${isEmail ? "Email" : "WhatsApp"}`}
      subtitle={`${documentType === "invoice" ? "Factura" : "Recibo"} ${documentNumber} — ${client.full_name}`}
      wide
    >
      <div className="space-y-4">
        {isEmail && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Para</label>
              <input type="text" readOnly value={client.email || ""}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Asunto</label>
              <input type="text" value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
          </>
        )}
        {!isEmail && (
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Enviar a</label>
            <input type="text" readOnly value={client.phone || ""}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
          <textarea value={body} rows={10}
            onChange={e => setBody(e.target.value)}
            className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => handleSave("draft")} disabled={saving}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar Borrador"}
          </button>
          {isEmail && (
            <button onClick={() => handleSave("sent")} disabled={saving || !smtpOk}
              title={!smtpOk ? "Configura SMTP en Ajustes para enviar" : ""}
              className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16} /> {!smtpOk ? "SMTP no configurado" : "Enviar Ahora"}
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
            Cancelar
          </button>
        </div>
        {isEmail && !smtpOk && (
          <p className="text-xs text-[#D4A0A0] text-center">Ve a Configuración → SMTP para habilitar el envío real</p>
        )}
      </div>
    </Modal>
  );
}
