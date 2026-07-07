"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { User } from "@/types/database";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ error: "Contexto no inicializado" }),
  signUp: async () => ({ error: "Contexto no inicializado" }),
  signOut: async () => {},
});

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        ensureProfile(session).then((profile) => {
          if (!cancelled) {
            setUser(profile);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isConfigured) return { error: "Supabase no configurado" };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      const profile = await ensureProfile(data);
      if (!profile) return { error: "Error al cargar el perfil" };
      setUser(profile);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Error inesperado" };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isConfigured) return { error: "Supabase no configurado" };
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return { error: error.message };
      if (data.user) {
        await supabase.from("users").insert({ id: data.user.id, name, email, role: "admin" });
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Error al registrar" };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isConfigured) await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
