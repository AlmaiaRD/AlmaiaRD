"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

/**
 * Registra el Service Worker y detecta actualizaciones.
 * Si hay una versión nueva, muestra toast para recargar.
 */
export function useSWUpdate() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    // Si la pagina aun no tenia un service worker controlando, este registro es
    // el primero: el SW simplemente toma control (clients.claim) y NO hay version
    // nueva que recargar. Recargar solo cuando ya habia uno evita un bucle de
    // recarga (registro -> claim -> controllerchange -> reload -> registro) que
    // abortaba las peticiones en vuelo y las mostraba como "Failed to fetch".
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Comprobar actualización al cargar y cada 30 min
      const check = () => reg.update();
      check();
      const interval = setInterval(check, 30 * 60 * 1000);

      // Cuando el SW nuevo está listo (waiting)
      let waiting = reg.waiting;
      if (waiting) showUpdateToast(waiting);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        waiting = installing;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(installing);
          }
        });
      });

      // Escuchar mensaje del SW (skipWaiting)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      return () => clearInterval(interval);
    });

    function showUpdateToast(sw: ServiceWorker) {
      toast("Nueva versión disponible", {
        icon: "🔄",
        duration: 10000,
      });
      // Botón personalizado no soportado en esta versión; el usuario recarga manual
      // o se recarga solo al detectar controllerchange
    }
  }, []);
}