"use client";

import { create } from "zustand";
import { supabase, isConfigured } from "@/lib/supabase";
import type { User } from "@/types/database";

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

async function ensureProfile(session: any): Promise<User | null> {
  if (!session?.user) return null;
  const userId = session.user.id;

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return existing as User;

  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario";
  const email = session.user.email || "";
  const { data: created, error } = await supabase
    .from("users")
    .insert({ id: userId, name, email, role: "admin" })
    .select()
    .single();

  if (error || !created) return null;
  return created as User;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (!isConfigured) {
      set({ initialized: true, loading: false });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await ensureProfile(session);
        set({ user: profile, initialized: true, loading: false });
      } else {
        set({ initialized: true, loading: false });
      }
    } catch {
      set({ initialized: true, loading: false });
    }
  },

  signIn: async (email, password) => {
    if (!isConfigured) return { error: "Supabase no está configurado. Revisa el archivo .env.local" };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      const profile = await ensureProfile(data);
      if (!profile) return { error: "Error al cargar tu perfil de usuario. Contacta al administrador." };

      set({ user: profile });
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Error inesperado al iniciar sesión" };
    }
  },

  signUp: async (email, password, name) => {
    if (!isConfigured) return { error: "Supabase no está configurado" };
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return { error: error.message };
      if (data.user) {
        await supabase.from("users").insert({
          id: data.user.id,
          name,
          email,
          role: "admin",
        });
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Error al registrar usuario" };
    }
  },

  signOut: async () => {
    if (isConfigured) await supabase.auth.signOut();
    set({ user: null });
  },
}));
