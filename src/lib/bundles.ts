import type { CatalogProduct } from "@/types/relations";

/** Filtros que solo existen dentro del selector de componentes de un bundle. */
export interface BundlePickerFilters {
  search: string;
  subbrandId: string;
}

/**
 * Productos que se pueden agregar a un bundle.
 *
 * El selector trabaja sobre el catálogo completo de activos, no sobre la lista
 * que la página esté mostrando: los filtros de la vista (búsqueda, marca,
 * categoría, "solo bundles", "archivados") no deben reducir los productos
 * disponibles para armar un combo.
 *
 * Tampoco se consulta stock. El inventario se valida al facturar; armar un
 * bundle no requiere que sus componentes tengan existencia.
 */
export function filterBundlePickerProducts(
  products: readonly CatalogProduct[],
  { search, subbrandId }: BundlePickerFilters
): CatalogProduct[] {
  const q = search.trim().toLowerCase();
  return products.filter((p) => {
    if (!p.active || p.is_bundle) return false;
    if (subbrandId && p.subbrand_id !== subbrandId) return false;
    if (q && !(`${p.name ?? ""}`.toLowerCase().includes(q) || `${p.code ?? ""}`.toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });
}
