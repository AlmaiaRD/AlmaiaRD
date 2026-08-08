import { supabase } from "@/lib/supabase";
import type { UserPreferences } from "@/types/database";

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data?.preferences as UserPreferences) || {};
}

export async function updatePreferences(userId: string, prefs: Partial<UserPreferences>) {
  const current = await getPreferences(userId);
  const merged = { ...current, ...prefs };
  const { error } = await supabase
    .from("users")
    .update({ preferences: merged })
    .eq("id", userId);
  if (error) throw error;
  return merged;
}
