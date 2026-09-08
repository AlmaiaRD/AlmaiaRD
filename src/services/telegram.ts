import { supabase } from "@/lib/supabase";

export interface TelegramConfig {
  id: string;
  label: string;
  bot_token: string;
  owner_chat_id: string | null;
  is_active: boolean;
  has_token?: boolean;
}

export interface TelegramLogRow {
  id: string;
  chat_id: string | null;
  direction: string | null;
  message_type: string | null;
  message_body: string | null;
  status: string | null;
  message_id: string | null;
  error: string | null;
  status_updated_at: string | null;
  created_at: string | null;
}

// Get Telegram configurations (sin secretos: el bot_token nunca viaja al
// navegador; solo se expone has_token vía RPC get_telegram_configs_public).
export async function getTelegramConfigs(): Promise<TelegramConfig[]> {
  const { data, error } = await supabase.rpc("get_telegram_configs_public");

  if (error) throw error;
  return (data || []).map((row: { id: string; label: string; owner_chat_id: string | null; is_active: boolean; has_token?: boolean | null }) => ({
    id: row.id,
    label: row.label,
    bot_token: "",
    owner_chat_id: row.owner_chat_id,
    is_active: row.is_active,
    has_token: Boolean(row.has_token),
  }));
}

// Create Telegram configuration (admin-only insert; el token se guarda en BD).
export async function createTelegramConfig(config: {
  label: string;
  bot_token: string;
  owner_chat_id?: string | null;
  is_active?: boolean;
}): Promise<TelegramConfig> {
  const { data, error } = await supabase
    .from("telegram_configs")
    .insert(config)
    .select("id, label, owner_chat_id, is_active")
    .single();

  if (error) throw error;
  return { ...data, bot_token: "", has_token: true };
}

// Update Telegram configuration (solo token si se envía nuevo).
export async function updateTelegramConfig(id: string, config: {
  label?: string;
  bot_token?: string;
  owner_chat_id?: string | null;
  is_active?: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("telegram_configs")
    .update(config)
    .eq("id", id);

  if (error) throw error;
}

// Delete Telegram configuration
export async function deleteTelegramConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from("telegram_configs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Registrar el webhook del bot en Telegram (setWebhook). Se genera y guarda un
// secret_token para que Telegram lo envíe en cada update y el server lo valide.
export async function registerTelegramWebhook(
  configId: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/telegram/webhook/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, webhookUrl }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, ...data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

// Send Telegram message through the server API route. El bot_token se resuelve
// en el servidor (RLS admin-only) y nunca llega al navegador.
export async function sendViaTelegramApi(
  configId: string,
  chatId: string,
  text: string,
  media?: { mediaUrl: string; mediaType: "photo" | "document" | "video" | "audio" }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, chatId, text, ...(media || {}) }),
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

// Log message to database
export async function logTelegramMessage(
  configId: string,
  chatId: string,
  text: string,
  status: string = "sent",
  messageId?: string,
  error?: string
): Promise<void> {
  const { error: insertError } = await supabase.from("telegram_logs").insert({
    config_id: configId,
    chat_id: chatId,
    direction: "outgoing",
    message_type: "text",
    message_body: text,
    status,
    message_id: messageId,
    error,
  });
  if (insertError) throw insertError;
}

// Get message logs
export async function getTelegramLogs(configId?: string): Promise<TelegramLogRow[]> {
  let query = supabase
    .from("telegram_logs")
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

// Modelo A: aviso automático al dueño configurado (owner_chat_id) con el bot
// activo. No lanza errores: si no hay bot activo / chat_id del dueño, se ignora
// silenciosamente para no interrumpir el flujo del negocio.
export async function notifyOwner(title: string, details: string): Promise<boolean> {
  try {
    const [configs, { data: userData }] = await Promise.all([
      getTelegramConfigs(),
      supabase.auth.getUser(),
    ]);
    const config = (configs || []).find((c) => c.is_active && c.owner_chat_id);
    const actor = userData?.user?.email ? ` · ${userData.user.email}` : "";
    if (!config?.owner_chat_id) return false;

    const message = `<b>${escapeHtml(title)}</b>\n${escapeHtml(details)}${actor}`;
    const result = await sendViaTelegramApi(config.id, config.owner_chat_id, message);
    if (!result.success) return false;
    await logTelegramMessage(config.id, config.owner_chat_id, message, "sent", result.messageId);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Modelo B: enviar un mensaje al cliente cuyo clients.telegram_chat_id coincide.
// Devuelve false si no hay bot activo o el cliente no tiene chat vinculado.
export async function notifyClient(
  client: { id: string; full_name?: string | null; telegram_chat_id?: string | null },
  text: string
): Promise<boolean> {
  try {
    if (!client.telegram_chat_id) return false;
    const configs = await getTelegramConfigs();
    const config = (configs || []).find((c) => c.is_active);
    if (!config) return false;

    const safeText = `<b>Almaia RD</b> — ${client.full_name || "cliente"}\n${text}`;
    const result = await sendViaTelegramApi(config.id, client.telegram_chat_id, safeText);
    if (!result.success) return false;
    await logTelegramMessage(config.id, client.telegram_chat_id, safeText, "sent", result.messageId);
    return true;
  } catch {
    return false;
  }
}