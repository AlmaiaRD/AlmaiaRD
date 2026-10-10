"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_FAVORITES } from "@/lib/modules";
import { supabase } from "@/lib/supabase";
import { getPreferences, updatePreferences } from "@/services/preferences";

const STORAGE_KEY = "almaia.favorites.v1";

function parseFavorites(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h) => typeof h === "string") : [];
  } catch {
    return [];
  }
}

function readLocalFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseFavorites(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

async function fetchServerFavorites(): Promise<string[]> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return [];
    const prefs = await getPreferences(data.user.id);
    return Array.isArray(prefs.favorites) ? prefs.favorites.filter((h) => typeof h === "string") : [];
  } catch {
    return []; // si falla la red, se mantiene la caché local
  }
}

async function saveServerFavorites(list: string[]): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) await updatePreferences(data.user.id, { favorites: list });
  } catch {
    /* error de red: la próxima carga reintentará sincronizar */
  }
}

/**
 * Favoritos del usuario: lista de `href` de módulos fijados.
 *
 * La fuente de verdad es `users.preferences.favorites` (por usuario),
 * persistida con el mismo servicio que usa el dashboard (metas), que ya
 * funciona con RLS. localStorage actúa como caché local para mostrar la UI
 * de inmediato antes de sincronizar.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readLocalFavorites);
  const [loading, setLoading] = useState(true);

  /** Sincroniza desde Supabase (fuente de verdad por usuario). */
  const refresh = useCallback(async () => {
    const serverFav = await fetchServerFavorites();
    setFavorites(serverFav);
    writeLocalFavorites(serverFav);
    setLoading(false);
  }, []);

  // Sincronización inicial desde el servidor (fuente de verdad por usuario).
  useEffect(() => {
    let cancelled = false;
    fetchServerFavorites()
      .then((serverFav) => {
        if (cancelled) return;
        setFavorites(serverFav);
        writeLocalFavorites(serverFav);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Sincroniza entre pestañas: si Configuración guarda favoritos en otra
    // pestaña, el menú se actualiza al recibir el evento storage.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setFavorites(parseFavorites(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const persist = useCallback(async (next: string[]) => {
    setFavorites(next);
    writeLocalFavorites(next);
    await saveServerFavorites(next);
  }, []);

  /** Marca/desmarca un módulo como favorito (pin rápido). */
  const toggleFavorite = useCallback(
    (href: string) => {
      setFavorites((prev) => {
        const has = prev.includes(href);
        const next = has
          ? prev.filter((h) => h !== href)
          : [...prev, href].slice(0, MAX_FAVORITES);
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  /** Sustituye la lista completa (usado desde Configuración). */
  const setFavoriteList = useCallback(
    (list: string[]) => {
      const cleaned = [...new Set(list)].filter((h) => typeof h === "string").slice(0, MAX_FAVORITES);
      void persist(cleaned);
    },
    [persist]
  );

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites]);

  return { favorites, loading, refresh, toggleFavorite, setFavoriteList, isFavorite };
}

export type UseFavorites = ReturnType<typeof useFavorites>;