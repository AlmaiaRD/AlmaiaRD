import { supabase } from "@/lib/supabase";
import type { Client, ClientTag, ClientTagRelation } from "@/types/database";

export async function getClients() {
  const { data, error } = await supabase.from("clients").select("*").order("full_name");
  if (error) throw error;
  return data as Client[];
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Client;
}

export async function createClient(client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").insert(client).select().single();
  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").update(client).eq("id", id).select().single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function searchClients(query: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,ibo_number.ilike.%${query}%`)
    .order("full_name");
  if (error) throw error;
  return data as Client[];
}

export async function getClientTags() {
  const { data, error } = await supabase.from("client_tags").select("*").order("name");
  if (error) throw error;
  return data as ClientTag[];
}

export async function getClientTagRelations(clientId: string) {
  const { data, error } = await supabase
    .from("client_tag_relations")
    .select("*, client_tags(*)")
    .eq("client_id", clientId);
  if (error) throw error;
  return data;
}
