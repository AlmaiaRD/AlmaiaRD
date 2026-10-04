import { QueryClient } from "@tanstack/react-query";

/**
 * Ajustes pensados para esta app, que es casi toda de lectura y cambia de
 * pantalla en pantalla:
 *
 * - staleTime 30s: si el usuario va y vuelve a la pagina en menos de medio
 *   minuto, no vuelve a pegarle a Supabase. Antes cada montaje hacia la
 *   consulta otra vez.
 * - retry 1: un reintento salva de un corte momentaneo de red, pero no
 *   insiste cinco veces cuando el error es real (por ejemplo, sin permiso).
 * - refetchOnWindowFocus false: cambiar de ventana de la aplicacion no
 *   dispara peticiones, porque los datos de medio minuto atras ya sirven.
 *
 * En el servidor se crea un cliente por peticion (ver QueryProvider) para que
 * dos visitas simultaneas no compartan cache.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
