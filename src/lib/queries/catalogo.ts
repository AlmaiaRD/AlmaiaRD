"use client";

import { useQuery } from "@tanstack/react-query";
import { getProducts, searchProducts, getBundleItemsBatch } from "@/services/products";

/** Lo unico que este hook necesita saber de un producto. */
export interface CatalogProductLike {
  id: string;
  active: boolean;
  subbrand_id?: string | null;
  category_id?: string | null;
  is_bundle?: boolean | null;
  bundle_items?: unknown;
}

export interface CatalogFilters {
  search: string;
  subbrandId: string;
  categoryId: string;
  bundlesOnly: boolean;
  includeArchived: boolean;
}

/**
 * Clave de la consulta. Vive en una funcion aparte porque la pagina la
 * necesita para escribir en la cache (cambios optimistas de precio, ITBIS,
 * descripcion...). React Query no acepta claves parciales: hay que pasarle
 * exactamente la misma, y tenerla duplicada en dos sitios es la forma segura
 * de que un dia dejen de coincidir.
 */
export function catalogKey(filters: CatalogFilters) {
  return [
    "catalog",
    {
      search: filters.search.trim(),
      subbrandId: filters.subbrandId,
      categoryId: filters.categoryId,
      bundlesOnly: filters.bundlesOnly,
      includeArchived: filters.includeArchived,
    },
  ] as const;
}

/**
 * Baja los items de los bundles que aun no los traen. Va despues de filtrar a
 * proposito: si se filtrara antes, cada cambio de filtro pediria los items de
 * todos los bundles del catalogo y no solo de los que se van a ver.
 */
async function attachBundleItems<T extends CatalogProductLike>(list: T[]): Promise<T[]> {
  const bundles = list.filter((p) => p.is_bundle && !p.bundle_items);
  if (bundles.length === 0) return list;
  try {
    const items = await getBundleItemsBatch(bundles.map((b) => b.id));
    const grouped = new Map<string, unknown[]>();
    for (const it of items) {
      const arr = grouped.get(it.bundle_id) || [];
      arr.push(it);
      grouped.set(it.bundle_id, arr);
    }
    return list.map((p) => {
      if (p.is_bundle && grouped.has(p.id)) {
        Object.assign(p, { bundle_items: grouped.get(p.id) });
      }
      return p;
    });
  } catch {
    // Si los items no llegan, el catalogo se muestra igual sin el detalle de
    // los bundles: es preferible a dejar la pagina en blanco.
    return list;
  }
}

/**
 * Catalogo de productos con busqueda y filtros de submarca, categoria y
 * bundles. Los cinco filtros van dentro de la misma clave, y cada combinacion
 * se guarda por separado: volver a un filtro que ya se visito reutiliza lo
 * descargado en vez de volver a pegarle a Supabase.
 */
export function useCatalog<T extends CatalogProductLike>(filters: CatalogFilters) {
  const trimmed = filters.search.trim();

  return useQuery({
    queryKey: catalogKey(filters),
    queryFn: async (): Promise<T[]> => {
      const base = trimmed ? await searchProducts(trimmed) : await getProducts(true);
      let rows = base as T[];

      if (filters.subbrandId) rows = rows.filter((p) => p.subbrand_id === filters.subbrandId);
      if (filters.categoryId) rows = rows.filter((p) => p.category_id === filters.categoryId);
      if (filters.bundlesOnly) rows = rows.filter((p) => p.is_bundle);

      // "Ver archivados" es un filtro, no un "mostrar tambien": enseña
      // unicamente los productos archivados, que es como estaba antes.
      rows = rows.filter((p) => (filters.includeArchived ? !p.active : p.active));

      return attachBundleItems(rows);
    },
  });
}
