"use client"; // Los error boundaries deben ser Client Components

import { useEffect } from "react";
import { Flower2, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Pantalla de "Ups, algo salió mal" para toda la sección del dashboard.
 *
 * Next.js la muestra automáticamente cuando una página del dashboard lanza un
 * error inesperado (por ejemplo, se corta internet o Supabase falla). En vez de
 * que la app "se caiga" sin aviso, aparece este mensaje con la opción de
 * reintentar (retry vuelve a intentar cargar la sección) o de volver al inicio.
 *
 * Nota: en esta versión de Next.js el prop se llama `retry` (v16.3+), no `reset`.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Se registra en consola para depurar; en producción el mensaje real del
    // error no se expone al usuario por seguridad.
    console.error("[dashboard:error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-[#F5EFE9] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-16 h-16 rounded-full bg-[#BA4A3A]/10 flex items-center justify-center mb-6">
        <Flower2 size={32} className="text-[#BA4A3A]" />
      </div>
      <h1 className="text-[32px] font-marca text-[#39484F] mb-2">Ups, algo salió mal</h1>
      <p className="text-base text-[#4C5760] mb-2 text-center max-w-sm">
        No pudimos cargar esta sección. Puede ser un problema de conexión o un
        fallo temporal.
      </p>
      <p className="text-sm text-[#8A9199] mb-8 text-center max-w-sm">
        Tus datos no se han perdido. Intenta de nuevo.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex items-center gap-2 h-12 px-6 bg-[#819E82] text-white rounded-xl text-sm font-medium hover:bg-[#6E8A70] transition-all shadow-sm"
        >
          <RefreshCw size={18} /> Reintentar
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 h-12 px-6 border border-[#E0DAD3] text-[#39484F] rounded-xl text-sm font-medium hover:bg-[#F1E9DF] transition-all"
        >
          <Home size={18} /> Ir al inicio
        </Link>
      </div>

      {error?.digest ? (
        <p className="mt-8 text-xs text-[#A9A29B]">Código: {error.digest}</p>
      ) : null}
    </div>
  );
}
