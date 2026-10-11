// Almaia SW v5 - sin caché: siempre red, y limpia cualquier caché vieja.
// Esto garantiza que la app siempre cargue la versión más reciente del servidor.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Intercepta únicamente para no guardar nada en caché y servir siempre de red.
self.addEventListener("fetch", () => {});

// Notificar a clientes que hay versión nueva
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
