import { supabase } from "@/lib/supabase";
import type { Bonus } from "@/types/database";

export async function getBonuses() {
  const { data, error } = await supabase
    .from("bonuses")
    .select("*")
    .order("bonus_date", { ascending: false });
  if (error) throw error;
  return data as Bonus[];
}

export async function createBonus(bonus: Partial<Bonus>) {
  const { data, error } = await supabase
    .from("bonuses")
    .insert(bonus)
    .select()
    .single();
  if (error) throw error;
  return data as Bonus;
}

export async function updateBonus(id: string, bonus: Partial<Bonus>) {
  const { data, error } = await supabase
    .from("bonuses")
    .update(bonus)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Bonus;
}

export async function deleteBonus(id: string) {
  const { error } = await supabase.from("bonuses").delete().eq("id", id);
  if (error) throw error;
}