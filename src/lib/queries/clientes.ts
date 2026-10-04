"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getClientsPaginated, searchClients } from "@/services/clients";
import type { Client } from "@/types/database";

export const CLIENTS_PAGE_SIZE = 50;

export interface ClientsPage {
  clients: Client[];
  total: number;
}

/**
 * La lista de clientes con paginacion y busqueda.
 *
 * `placeholderData: keepPreviousData` es lo que evita el parpadeo: mientras
 * llega la pagina 3, se sigue viendo la pagina 2 en lugar de una tabla en
 * blanco. Antes la pagina borraba la lista y recargaba entera.
 */
export function useClients(page: number, search: string) {
  const trimmed = search.trim();

  return useQuery({
    queryKey: ["clients", { page, search: trimmed }],
    queryFn: async (): Promise<ClientsPage> => {
      if (trimmed) {
        const data = await searchClients(trimmed);
        return { clients: data, total: data.length };
      }
      const result = await getClientsPaginated(page, CLIENTS_PAGE_SIZE);
      return { clients: result.data, total: result.total };
    },
    placeholderData: keepPreviousData,
  });
}

export function clientsKey() {
  return ["clients"] as const;
}
