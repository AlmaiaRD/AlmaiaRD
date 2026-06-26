import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/search";
import type { Client, ClientTag, ClientTagRelation } from "@/types/database";

export async function getClients() {
  const { data, error } = await supabase.from("clients").select("*").order("full_name");
  if (error) throw error;
  return data as Client[];
}

export async function getClientsWithBalances() {
  const clients = await getClients();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("client_id, balance_due")
    .neq("status", "PAID");
  if (error) throw error;
  const balanceMap: Record<string, number> = {};
  for (const inv of invoices || []) {
    balanceMap[inv.client_id] = (balanceMap[inv.client_id] || 0) + Number(inv.balance_due);
  }
  return clients.map(c => ({ ...c, pending_balance: balanceMap[c.id] || 0 }));
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se encontró el cliente");
  return data[0] as Client;
}

export async function createClient(client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").insert(client).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se pudo crear el cliente");
  return data[0] as Client;
}

export async function updateClient(id: string, client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").update(client).eq("id", id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El cliente no existe o no tienes permiso para actualizarlo");
  return data[0] as Client;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function searchClients(query: string) {
  const all = await getClients();
  const q = normalize(query);
  return all.filter(
    (c: Client) =>
      normalize(c.full_name).includes(q) ||
      (c.phone && normalize(c.phone).includes(q)) ||
      (c.email && normalize(c.email).includes(q)) ||
      (c.ibo_number && normalize(c.ibo_number).includes(q))
  );
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
