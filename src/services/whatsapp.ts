import { supabase } from "@/lib/supabase";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export interface WhatsAppConfig {
  id: string;
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  business_account_id: string;
  is_active: boolean;
  label: string;
  has_token?: boolean;
}

export interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>;
  };
  text?: {
    body: string;
  };
}

export interface MessageTemplate {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: Array<{
    type: string;
    text?: string;
    parameters?: Array<{ type: string; name: string }>;
  }>;
}

// Get WhatsApp configurations (sin secretos: el access_token nunca viaja al
// navegador; solo se expone has_token vía RPC get_whatsapp_configs_public).
export async function getWhatsAppConfigs(): Promise<WhatsAppConfig[]> {
  const { data, error } = await supabase.rpc("get_whatsapp_configs_public");

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    label: row.label,
    phone_number_id: row.phone_number_id,
    business_account_id: row.business_account_id,
    is_active: row.is_active,
    access_token: "",
    verify_token: "",
    has_token: Boolean(row.has_token),
  }));
}

// Create WhatsApp configuration
export async function createWhatsAppConfig(config: Omit<WhatsAppConfig, "id">): Promise<WhatsAppConfig> {
  const { data, error } = await supabase
    .from("whatsapp_configs")
    .insert(config)
    .select("id, label, phone_number_id, business_account_id, is_active, created_at")
    .single();

  if (error) throw error;
  return { ...data, access_token: "", verify_token: "" };
}

// Update WhatsApp configuration
export async function updateWhatsAppConfig(id: string, config: Partial<WhatsAppConfig>): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_configs")
    .update(config)
    .eq("id", id);

  if (error) throw error;
}

// Delete WhatsApp configuration
export async function deleteWhatsAppConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_configs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Send WhatsApp message through the server API route. El access_token se
// resuelve en el servidor (RLS admin-only) y nunca llega al navegador.
export async function sendViaApi(
  configId: string,
  to: string,
  type: "text" | "template",
  payload: { text?: string; template?: WhatsAppMessage["template"] }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, to, type, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Error al enviar el mensaje" };
    }
    return { success: true, messageId: data.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

// Send WhatsApp message using Cloud API
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: WhatsAppMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...message,
        messaging_product: "whatsapp",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Error sending message",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Send template message
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = "es",
  variables?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const components = variables
    ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
    : undefined;

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  });
}

// Send text message
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendWhatsAppMessage(phoneNumberId, accessToken, to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// Send invoice via WhatsApp
export async function sendInvoiceViaWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  clientPhone: string,
  invoiceNumber: string,
  total: number,
  dueDate?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const variables = [invoiceNumber, `RD$ ${total.toLocaleString()}`];
  if (dueDate) variables.push(dueDate);

  return sendTemplateMessage(
    phoneNumberId,
    accessToken,
    clientPhone,
    "invoice_notification",
    "es",
    variables
  );
}

// Send payment reminder
export async function sendPaymentReminder(
  phoneNumberId: string,
  accessToken: string,
  clientPhone: string,
  clientName: string,
  amount: number,
  dueDate: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendTemplateMessage(
    phoneNumberId,
    accessToken,
    clientPhone,
    "payment_reminder",
    "es",
    [clientName, `RD$ ${amount.toLocaleString()}`, dueDate]
  );
}

// Get message templates from WhatsApp Business Account (server-side, admin).
export async function getMessageTemplates(
  businessAccountId: string,
  accessToken: string,
  configId?: string
): Promise<MessageTemplate[]> {
  try {
    if (configId) {
      const res = await fetch(`/api/whatsapp/templates?configId=${configId}`);
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    }
    const response = await fetch(
      `${WHATSAPP_API_URL}/${businessAccountId}/message_templates`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// Log message to database
export async function logWhatsAppMessage(
  configId: string,
  to: string,
  messageType: string,
  templateName?: string,
  status: string = "sent",
  messageId?: string,
  error?: string
): Promise<void> {
  const { error: insertError } = await supabase.from("whatsapp_logs").insert({
    config_id: configId,
    recipient: to,
    message_type: messageType,
    template_name: templateName,
    status,
    message_id: messageId,
    error,
  });
  if (insertError) throw insertError;
}

// Get message logs
export async function getWhatsAppLogs(configId?: string): Promise<any[]> {
  let query = supabase
    .from("whatsapp_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (configId) {
    query = query.eq("config_id", configId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Verify webhook
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  verifyToken: string
): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}

// Process incoming webhook message
export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename: string };
}

export function parseWebhookMessage(body: any): IncomingMessage | null {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (!messages || messages.length === 0) return null;

    return messages[0];
  } catch {
    return null;
  }
}
