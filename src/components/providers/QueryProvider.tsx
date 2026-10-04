"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState con inicializador perezoso: se crea un QueryClient por sesion del
  // navegador. Si se creara con useMemo o directamente en el cuerpo, cada
  // rerender borraria la cache y las consultas se repetirian sin parar.
  const [queryClient] = useState(makeQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default QueryProvider;
