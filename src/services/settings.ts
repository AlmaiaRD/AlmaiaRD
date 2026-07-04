import { supabase } from "@/lib/supabase";
import type { Settings } from "@/types/database";

export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();

  if (data) return data as Settings;

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
  return created as Settings;
}

export async function updateSettings(settings: Partial<Settings>) {
  if (!settings.id) throw new Error("Settings ID is required");
  const { data, error } = await supabase
    .from("settings")
    .update({
      business_name: settings.business_name,
      logo_url: settings.logo_url,
      signature_url: settings.signature_url,
      email: (settings as any).email,
      phone: (settings as any).phone,
      sender_name: (settings as any).sender_name,
      email_template: (settings as any).email_template,
      whatsapp_template: (settings as any).whatsapp_template,
      smtp_host: (settings as any).smtp_host,
      smtp_port: (settings as any).smtp_port,
      smtp_user: (settings as any).smtp_user,
      smtp_pass: (settings as any).smtp_pass,
      smtp_secure: (settings as any).smtp_secure,
      ai_client_prompt: (settings as any).ai_client_prompt,
      ai_learning_prompt: (settings as any).ai_learning_prompt,
      default_margin: settings.default_margin,
      invoice_prefix: settings.invoice_prefix,
      receipt_prefix: settings.receipt_prefix,
      purchase_prefix: settings.purchase_prefix,
    })
    .eq("id", settings.id)
    .select()
    .single();
  if (error) throw error;
  return data as Settings;
}

export async function getBankAccounts() {
  const { data, error } = await supabase.from("bank_accounts").select("*").order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBankAccount(account: any) {
  const { data, error } = await supabase.from("bank_accounts").insert(account).select().single();
  if (error) throw error;
  return data;
}

export async function updateBankAccount(id: string, account: any) {
  const { data, error } = await supabase.from("bank_accounts").update(account).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBankAccount(id: string) {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
}
