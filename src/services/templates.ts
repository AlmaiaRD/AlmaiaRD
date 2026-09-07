import { supabase } from "@/lib/supabase";

export type TemplateChannel = "whatsapp" | "telegram" | "email";

export interface CommunicationTemplate {
  id: string;
  channel: TemplateChannel;
  name: string;
  message: string;
  variables: string[];
  category: string;
  is_system: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TemplateInput = {
  channel: TemplateChannel;
  name: string;
  message: string;
  variables: string[];
  category: string;
};

// Get templates por canal (ordenados por actualización reciente).
export async function getTemplates(channel?: TemplateChannel): Promise<CommunicationTemplate[]> {
  let query = supabase
    .from("communication_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Create template
export async function createTemplate(input: TemplateInput): Promise<CommunicationTemplate> {
  const { data, error } = await supabase
    .from("communication_templates")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Update template
export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<void> {
  const { error } = await supabase
    .from("communication_templates")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

// Delete template
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("communication_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Inferir variables ({var}) desde el texto del mensaje.
export function extractVariables(message: string): string[] {
  const matches = message.match(/\{([^}]+)\}/g) || [];
  const vars = matches.map((m) => m.replace(/[{}]/g, ""));
  return [...new Set(vars)];
}

// Reemplazar placeholders {var} por [var] para edición manual.
export function applyTemplate(message: string): string {
  return message.replace(/\{([^}]+)\}/g, "[$1]");
}