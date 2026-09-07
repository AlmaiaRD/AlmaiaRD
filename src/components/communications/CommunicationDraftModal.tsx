"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Send } from "lucide-react";
import { generateEmailDraft, generateWhatsAppDraft, createCommunication } from "@/services/communications";
import { getWhatsAppConfigs, sendViaApi, logWhatsAppMessage } from "@/services/whatsapp";
import type { WhatsAppConfig } from "@/services/whatsapp";
import toast from "react-hot-toast";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  configured: boolean;
  secure: boolean;
  senderName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "email" | "whatsapp";
  client: { id: string; full_name: string; email?: string; phone?: string };
  documentType: "invoice" | "receipt" | "quote";
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
  const [whatsappConfigs, setWhatsappConfigs] = useState<WhatsAppConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const smtpOk = isEmail && smtp?.host && smtp?.user && smtp?.configured;

  useEffect(() => {
    if (isEmail) return;
    getWhatsAppConfigs()
      .then((configs) => {
        const active = configs.filter((c) => c.is_active);
        setWhatsappConfigs(active);
        if (active.length > 0) setSelectedConfigId(active[0].id);
      })
      .catch(() => setWhatsappConfigs([]));
  }, [isEmail]);

  async function handleSave(status: "draft" | "sent" = "draft") {
    setSaving(true);
    try {
      if (status === "sent" && isEmail && smtpOk) {
        let attachment: { filename: string; base64: string } | undefined;
        if (getAttachment) attachment = await getAttachment();
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: client.email,
            subject,
            body,
            attachment,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al enviar");
        }
      }

      if (status === "sent" && !isEmail) {
        if (!selectedConfigId) {
          throw new Error("Configura primero una cuenta de WhatsApp activa en el módulo WhatsApp");
        }
        const result = await sendViaApi(selectedConfigId, client.phone || "", "text", { text: body });
        if (!result.success) {
          throw new Error(result.error || "Error al enviar el mensaje de WhatsApp");
        }
        logWhatsAppMessage(selectedConfigId, client.phone || "", "text", undefined, "sent", result.messageId).catch(() => {});
      }

      const commStatus = status === "sent" ? "sent" : "draft";
      await createCommunication({
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
    } catch (err: unknown) {
      toast.error((err as { message?: string } | null)?.message || "Error al guardar borrador");
    }
    finally { setSaving(false); }
  }

  const whatsappReady = !isEmail && selectedConfigId && client.phone;

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`Preparar ${isEmail ? "Email" : "WhatsApp"}`}
      subtitle={`${documentType === "invoice" ? "Factura" : documentType === "quote" ? "Cotización" : "Recibo"} ${documentNumber} — ${client.full_name}`}
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
          <>
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Enviar a</label>
              <input type="text" readOnly value={client.phone || ""}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm" />
            </div>
            {whatsappConfigs.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Cuenta de WhatsApp</label>
                <select
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  {whatsappConfigs.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </>
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
          {!isEmail ? (
            <button onClick={() => handleSave("sent")} disabled={saving || !whatsappReady}
              title={!whatsappReady ? "Configura una cuenta de WhatsApp activa y el cliente debe tener teléfono" : ""}
              className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16} /> {!whatsappReady ? "Configura tu cuenta WhatsApp" : "Enviar Ahora"}
            </button>
          ) : (
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
        {!isEmail && whatsappConfigs.length === 0 && (
          <p className="text-xs text-[#D4A0A0] text-center">Ve al módulo WhatsApp → Configuraciones para agregar una cuenta activa</p>
        )}
      </div>
    </Modal>
  );
}
