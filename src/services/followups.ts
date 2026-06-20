import { supabase } from "@/lib/supabase";
import type { Followup } from "@/types/database";

export async function getClientFollowups(clientId: string) {
  const { data, error } = await supabase
    .from("followups")
    .select("*")
    .eq("client_id", clientId)
    .order("contact_date", { ascending: false });
  if (error) throw error;
  return data as Followup[];
}

export async function getAllFollowups() {
  const { data, error } = await supabase
    .from("followups")
    .select("*, clients(full_name, phone)")
    .order("contact_date", { ascending: false });
  if (error) throw error;
  return data as (Followup & { clients: { full_name: string; phone: string } })[];
}

export async function createFollowup(followup: Partial<Followup>) {
  const { data, error } = await supabase
    .from("followups")
    .insert(followup)
    .select()
    .single();
  if (error) throw error;
  return data as Followup;
}

export async function updateFollowup(id: string, followup: Partial<Followup>) {
  const { data, error } = await supabase
    .from("followups")
    .update(followup)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Followup;
}

export async function updateFollowupStatus(id: string, status: Followup["status"]) {
  const { error } = await supabase.from("followups").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteFollowup(id: string) {
  const { error } = await supabase.from("followups").delete().eq("id", id);
  if (error) throw error;
}
