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

/**
 * Guarda preferencias del usuario.
 *
 * Las escrituras van por `/api/preferences` (no directo a Supabase) porque esa
 * ruta autentica al usuario y escribe con service role, evitando depender de la
 * política RLS de UPDATE sobre `users` (que puede faltar en el proyecto y hacía
 * que los cambios se descartaran en silencio). El alcance queda fijado al
 * propio usuario en el servidor.
 */
export async function updatePreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  void userId; // el id efectivo se deriva de la sesión en el servidor
  const res = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) {
    let message = "Error al guardar preferencias";
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch {
      /* noop */
    }
    throw new Error(message);
  }
  const json = await res.json();
  return (json?.preferences as UserPreferences) || {};
}
