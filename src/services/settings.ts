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
