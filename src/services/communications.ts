import { supabase } from "@/lib/supabase";
import type { Communication } from "@/types/database";

export async function getCommunications(clientId?: string) {
  let query = supabase
    .from("communications")
    .select("*, clients(full_name, phone, email)")
    .order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCommunication(comm: Partial<Communication>) {
  const { data, error } = await supabase.from("communications").insert(comm).select().single();
  if (error) throw error;
  return data as Communication;
}

export async function updateCommunication(id: string, comm: Partial<Communication>) {
  const { error } = await supabase.from("communications").update(comm).eq("id", id);
  if (error) throw error;
}

export async function deleteCommunication(id: string) {
  const { error } = await supabase.from("communications").delete().eq("id", id);
  if (error) throw error;
}

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

const DEFAULT_EMAIL_TEMPLATE = `Hola, {{clientName}}.

Espero que te encuentres muy bien.

Te comparto adjunta {{label}} correspondiente a tu transacción realizada en {{businessName}}.

Si tienes alguna duda o necesitas asistencia, estaré encantada de ayudarte.

Muchas gracias por tu confianza.

Saludos,
{{senderName}}`;

const DEFAULT_WHATSAPP_TEMPLATE = `Hola {{clientName}} 👋

Te envío {{label}} {{documentNumber}} por un total de {{total}}.

Gracias por tu confianza.

{{businessName}}`;

export function generateEmailDraft(params: {
  clientName: string;
  clientEmail: string;
  documentType: "invoice" | "receipt";
  documentNumber: string;
  businessName: string;
  senderEmail?: string;
  senderName?: string;
  template?: string;
}) {
  const { clientName, clientEmail, documentType, documentNumber, businessName, senderEmail, senderName, template } = params;
  const label = documentType === "invoice" ? "Factura" : "Recibo";
  const from = senderEmail || "noreply@almaia-rd.com";
  const fromName = senderName || businessName;

  const body = fillTemplate(template || DEFAULT_EMAIL_TEMPLATE, {
    clientName,
    documentType: label,
    documentNumber,
    businessName,
    senderName: fromName,
    label: label.toLowerCase(),
  });

  return {
    from: `${fromName} <${from}>`,
    to: clientEmail,
    subject: `${label} ${documentNumber} – ${businessName}`,
    body,
  };
}

export function generateWhatsAppDraft(params: {
  clientName: string;
  documentType: "invoice" | "receipt";
  documentNumber: string;
  total: string;
  businessName: string;
  template?: string;
}) {
  const { clientName, documentType, documentNumber, total, businessName, template } = params;
  const label = documentType === "invoice" ? "Factura" : "Recibo";

  const text = fillTemplate(template || DEFAULT_WHATSAPP_TEMPLATE, {
    clientName,
    documentType: label,
    documentNumber,
    total,
    businessName,
    label: label.toLowerCase(),
  });

  return { text };
}
