import { supabase } from "@/lib/supabase";
import type { Supplier } from "@/types/database";

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createSupplier(data: {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
}) {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return supplier;
}

export async function updateSupplier(
  id: string,
  data: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    city?: string;
    notes?: string;
  }
) {
  const { error } = await supabase
    .from("suppliers")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
