"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_FAVORITES } from "@/lib/modules";

const STORAGE_KEY = "almaia.favorites.v1";

/**
 * Favoritos del usuario: lista de `href` de módulos fijados.
 *
 * La fuente de verdad es `users.preferences.favorites` (por usuario),
 * persistida vía la API de preferencias. Se usa localStorage como
 * caché local para mostrar la UI de inmediato antes de sincronizar.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const local = raw ? JSON.parse(raw) : [];
      return Array.isArray(local) ? local.filter((h) => typeof h === "string") : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const serverFav: string[] = Array.isArray(json?.preferences?.favorites)
          ? (json.preferences.favorites as string[]).filter((h) => typeof h === "string")
          : [];
        setFavorites(serverFav);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serverFav));
        } catch {
          /* noop */
        }
      })
      .catch(() => {
        /* si falla la red, mantenemos la caché local */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: string[]) => {
    setFavorites(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: next }),
      });
    } catch {
      /* error de red: la próxima carga reintentará sincronizar */
    }
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

  return { favorites, loading, toggleFavorite, setFavoriteList, isFavorite };
}

export type UseFavorites = ReturnType<typeof useFavorites>;