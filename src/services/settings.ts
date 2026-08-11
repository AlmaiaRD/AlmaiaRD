import { supabase } from "@/lib/supabase";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings, BankAccount } from "@/types/database";

export type SettingsResult = Settings & { has_smtp_password?: boolean };

function isMigrationPending(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error?.code === "PGRST202" || /could not find the function/i.test(error?.message || "")
  );
}

function normalizeSettings(row: Record<string, any>, includeSecrets: boolean): SettingsResult {
  const result = { ...row } as SettingsResult;
  if (!includeSecrets) {
    result.has_smtp_password = Boolean(row?.has_smtp_password ?? row?.smtp_pass);
    result.smtp_pass = "";
  }
  return result;
}

async function loadSettingsRow(
  includeSecrets: boolean,
  client: SupabaseClient<any> = supabase
): Promise<Record<string, any> | null> {
  const rpcName = includeSecrets ? "get_settings_with_secrets" : "get_settings_public";
  let result = await client.rpc(rpcName);
  if (isMigrationPending(result.error)) {
    // Migración aún no aplicada: los RPCs no existen todavía.
    result = await client.from("settings").select("*").limit(1).maybeSingle();
  }
  if (result.error) throw result.error;
  return Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
}

export async function getSettings(
  useCache = true,
  options?: { includeSecrets?: boolean; client?: SupabaseClient<any> }
): Promise<SettingsResult | null> {
  const includeSecrets = options?.includeSecrets ?? false;
  if (!includeSecrets && useCache) {
    const cached = getCached<SettingsResult>("settings");
    if (cached) return cached;
  }

  const row = await loadSettingsRow(includeSecrets, options?.client);

  if (row) {
    const result = normalizeSettings(row, includeSecrets);
    if (!includeSecrets) setCache("settings", result, 120_000);
    return result;
  }

  if (includeSecrets) return null;

  // No row exists — create one
  const { data: created, error: createError } = await supabase
    .from("settings")
    .insert({
      business_name: "Almaia RD",
      default_margin: 30,
      invoice_prefix: "FAC-",
      receipt_prefix: "REC-",
      purchase_prefix: "COM-",
      ai_client_prompt: `Eres un asesor de ventas de Amway. Genera un análisis breve en español para el vendedor sobre este cliente:

Cliente: {{clientName}}
Etapa: {{stage}}
Total facturado: RD\${{totalSpent}}
Deuda pendiente: RD\${{pendingBalance}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Responde SOLO en este formato (máximo 4 líneas):
RESUMEN: [2 oraciones sobre el cliente]
ABORDAJE: [1 sugerencia de cómo contactarlo y qué ofrecerle]`,
      ai_learning_prompt: `Eres un coach de negocios. Basado en esta nota de aprendizaje, genera una reflexión útil y un consejo práctico:

Título: {{title}}
Contenido: {{content}}
Etiquetas: {{tags}}

Responde en español en máximo 3 oraciones:`,
    })
    .select()
    .single();

  if (createError) throw createError;
  const result = normalizeSettings(created as Record<string, any>, false);
  setCache("settings", result, 120_000);
  return result;
}

export async function updateSettings(
  settings: Partial<Settings>,
  options?: { client?: SupabaseClient<any> }
) {
  if (!settings.id) throw new Error("Settings ID is required");
  const patch: Partial<Settings> = {
    business_name: settings.business_name,
    logo_url: settings.logo_url,
    signature_url: settings.signature_url,
    email: settings.email,
    phone: settings.phone,
    sender_name: settings.sender_name,
    email_template: settings.email_template,
    whatsapp_template: settings.whatsapp_template,
    smtp_host: settings.smtp_host,
    smtp_port: settings.smtp_port,
    smtp_user: settings.smtp_user,
    smtp_secure: settings.smtp_secure,
    ai_client_prompt: settings.ai_client_prompt,
    ai_learning_prompt: settings.ai_learning_prompt,
    default_margin: settings.default_margin,
    invoice_prefix: settings.invoice_prefix,
    receipt_prefix: settings.receipt_prefix,
    purchase_prefix: settings.purchase_prefix,
    currency: settings.currency,
    nutrilite_itbis_enabled: settings.nutrilite_itbis_enabled,
  };
  // No sobrescribir la contraseña SMTP cuando el cliente la envía vacía (enmascarada).
  if (settings.smtp_pass) {
    patch.smtp_pass = settings.smtp_pass;
  }
  const client = options?.client ?? supabase;
  // Sin .select(): tras la migración, smtp_pass no es seleccionable ni por admin.
  const { error } = await client.from("settings").update(patch).eq("id", settings.id);
  if (error) throw error;
  invalidateCache("settings");
  const fresh = await getSettings(false, { client });
  return fresh as Settings;
}

export async function getBankAccounts() {
  const { data, error } = await supabase.from("bank_accounts").select("*").order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBankAccount(account: Partial<BankAccount>) {
  const { data, error } = await supabase.from("bank_accounts").insert(account).select().single();
  if (error) throw error;
  return data;
}

export async function updateBankAccount(id: string, account: Partial<BankAccount>) {
  const { data, error } = await supabase.from("bank_accounts").update(account).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBankAccount(id: string) {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
}
