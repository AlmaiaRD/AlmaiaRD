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

// Get WhatsApp configurations
export async function getWhatsAppConfigs(): Promise<WhatsAppConfig[]> {
  const { data, error } = await supabase
    .from("whatsapp_configs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Create WhatsApp configuration
export async function createWhatsAppConfig(config: Omit<WhatsAppConfig, "id">): Promise<WhatsAppConfig> {
  const { data, error } = await supabase
    .from("whatsapp_configs")
    .insert(config)
    .select()
    .single();

  if (error) throw error;
  return data;
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
    ? [
        {
          type: "body",
          parameters: variables.map((v) => ({
            type: "text",
            text: v,
          })),
        },
      ]
    : undefined;

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
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

// Get message templates from WhatsApp Business Account
export async function getMessageTemplates(
  businessAccountId: string,
  accessToken: string
): Promise<MessageTemplate[]> {
  try {
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
  await supabase.from("whatsapp_logs").insert({
    config_id: configId,
    to,
    message_type: messageType,
    template_name: templateName,
    status,
    message_id: messageId,
    error,
  });
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
