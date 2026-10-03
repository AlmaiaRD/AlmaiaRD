import { supabase } from "@/lib/supabase";
import type { InventoryMovement } from "@/types/database";
import { notifyOwner } from "./telegram";

export async function getInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*, products(name, code, pv, cost, subbrands(name))")
    .order("products(name)");
  if (error) throw error;
  return data;
}

export async function getInventoryPaginated(page: number, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("inventory")
    .select("*, products(name, code, pv, cost, subbrands(name))", { count: "exact" })
    .order("products(name)")
    .range(from, to);
  if (error) throw error;
  return { data, total: count || 0, page, pageSize };
}

export async function getInventoryMovements(productId: string) {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as InventoryMovement[];
}

export async function updateMinimumStock(productId: string, minimum: number) {
  const { error } = await supabase
    .from("inventory")
    .update({ minimum_stock: minimum })
    .eq("product_id", productId);
  if (error) throw error;
}

export async function getLowStockProducts() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*, products(name, code)")
    .order("stock");
  if (error) throw error;
  return (data || []).filter((item: unknown) => {
    const i = item as Record<string, unknown>;
    return Number(i.stock) <= Number(i.minimum_stock);
  });
}

export async function addInventoryStock(productId: string, quantity: number, unitCost: number, lineTotal: number, movementType?: string, referenceType?: string, referenceId?: string) {
  const { error } = await supabase.rpc("add_inventory_stock", {
    p_product_id: productId,
    p_quantity: quantity,
    p_unit_cost: Math.round(unitCost * 100) / 100,
    p_line_total: Math.round(lineTotal * 100) / 100,
    p_movement_type: movementType || "PURCHASE",
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw error;
}

export async function subtractInventoryStock(productId: string, quantity: number, movementType?: string, referenceType?: string, referenceId?: string) {
  const { error } = await supabase.rpc("subtract_inventory_stock", {
    p_product_id: productId,
    p_quantity: quantity,
    p_movement_type: movementType || "SALE",
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw error;

  // Modelo A: aviso de stock bajo al dueño (no bloqueante, no altera el flujo).
  notifyLowStock(productId).catch(() => {});
}

async function notifyLowStock(productId: string) {
  const { data: row, error } = await supabase
    .from("inventory")
    .select("stock, minimum_stock, products(name, code)")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) return;
  if (!row) return;
  const stock = Number(row.stock) || 0;
  const minimum = Number(row.minimum_stock) || 0;
  if (stock > minimum) return;
  const name = (row.products as { name?: string; code?: string } | null)?.name || "Producto";
  const code = (row.products as { code?: string } | null)?.code || "";
  const emoji = stock <= 0 ? "AGOTADO" : "STOCK BAJO";
  await notifyOwner(`⚠️ ${emoji}: ${name}`, `${code ? code + " " : ""}Stock actual: ${stock}\nMínimo: ${minimum}`);
}

export async function restoreInventoryStock(productId: string, quantity: number, movementType?: string, referenceType?: string, referenceId?: string) {
  const { error } = await supabase.rpc("restore_inventory_stock", {
    p_product_id: productId,
    p_quantity: quantity,
    p_movement_type: movementType || "CANCELLATION",
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw error;
}

export async function checkCanDeleteProduct(productId: string) {
  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("stock")
    .eq("product_id", productId)
    .single();
  
  if (invError) throw invError;
  
  if (inventory.stock > 0) {
    throw new Error("No se puede eliminar el producto porque tiene stock actual");
  }
  
  const { count: movementCount, error: moveError } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("product_id", productId);
  
  if (moveError) throw moveError;
  
  if ((movementCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque tiene movimientos históricos");
  }
  
  const { count: invoiceCount, error: invItemError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("product_id", productId);
  
  if (invItemError) throw invItemError;
  
  if ((invoiceCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque está asociado a facturas");
  }
  
  const { count: purchaseCount, error: purItemError } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("product_id", productId);
  
  if (purItemError) throw purItemError;
  
  if ((purchaseCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque está asociado a compras");
  }
  
  return { affected: { movements: 0, invoices: 0, purchases: 0 } };
}

export async function getProductUsage(productId: string) {
  const [{ count: movementCount }, { count: invoiceCount }, { count: purchaseCount }] = await Promise.all([
    supabase.from("inventory_movements").select("*", { count: "exact", head: true }).eq("product_id", productId),
    supabase.from("invoice_items").select("*", { count: "exact", head: true }).eq("product_id", productId),
    supabase.from("purchase_items").select("*", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  return {
    movements: movementCount ?? 0,
    invoices: invoiceCount ?? 0,
    purchases: purchaseCount ?? 0,
  };
}

export async function deleteProduct(productId: string) {
  const usage = await getProductUsage(productId);
  if (usage.movements > 0) throw new Error("No se puede eliminar el producto porque tiene movimientos históricos");
  if (usage.invoices > 0) throw new Error("No se puede eliminar el producto porque está asociado a facturas");
  if (usage.purchases > 0) throw new Error("No se puede eliminar el producto porque está asociado a compras");

  const { count: bundleCount, error: bundleError } = await supabase
    .from("bundle_items")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (bundleError) throw bundleError;
  if ((bundleCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque es componente de un bundle");
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
  return true;
}

export async function forceDeleteProduct(productId: string) {
  const { count: invoiceCount } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((invoiceCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque está asociado a facturas");
  }
  const { count: purchaseCount } = await supabase
    .from("purchase_items")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((purchaseCount ?? 0) > 0) {
    throw new Error("No se puede eliminar el producto porque está asociado a compras");
  }
  const { error: mvError } = await supabase.from("inventory_movements").delete().eq("product_id", productId);
  if (mvError) throw mvError;
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
  return true;
}

/**
 * ¿La RPC de agregación todavía no existe en la base de datos?
 *
 * Mismo criterio que `isMigrationPending()` en `services/settings.ts`: la
 * aplicación suele desplegarse antes que la migración y no queremos dejar el
 * módulo de inventario sin datos.
 */
function isAggregationRpcMissing(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error?.code === "PGRST202" || /could not find the function/i.test(error?.message || "")
  );
}

/**
 * Convierte la salida de una función de agregación en el mapa
 * { [product_id]: fecha } que espera la interfaz.
 */
function rowsToDateMap(
  rows: Array<{ product_id: string | null; value: string | null }> | null,
  valueKey: string
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows || []) {
    if (!row?.product_id) continue;
    const value = (row as unknown as Record<string, unknown>)[valueKey];
    if (typeof value === "string" && value && !map[row.product_id]) {
      map[row.product_id] = value;
    }
  }
  return map;
}

/**
 * Última venta por producto, ignorando facturas canceladas.
 *
 * ANTES: se traían todas las facturas y luego sus renglones con
 * `.in("invoice_id", ids)` ordenando por `invoice_id` -- un UUID. El orden
 * de la consulta de renglones SOBRESCRIBÍA el orden por fecha de la consulta
 * de facturas, de modo que la fecha retenida por producto era arbitraria.
 *
 * AHORA: la agregación `DISTINCT ON` ocurre en la base de datos
 * (migración 20260910_product_date_aggregations.sql), que es además la única
 * forma de no enviar todas las facturas al cliente.
 */
export async function getLastSalePerProduct() {
  const { data, error } = await supabase.rpc("get_last_sale_per_product");
  if (!error) return rowsToDateMap(data as never, "last_date");

  // La migración aún no está aplicada: se conserva el comportamiento previo.
  if (!isAggregationRpcMissing(error)) throw error;
  return getLastSalePerProductLegacy();
}

/** Respaldo previo a la RPC. Ver `getLastSalePerProduct`. */
async function getLastSalePerProductLegacy(): Promise<Record<string, string>> {
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, invoice_date")
    .neq("status", "CANCELLED")
    .order("invoice_date", { ascending: false });

  if (invError) throw invError;

  const invoiceIds = (invoices || []).map(i => i.id);
  if (invoiceIds.length === 0) return {};

  const { data: items, error: itemError } = await supabase
    .from("invoice_items")
    .select("product_id, invoice_id")
    .in("invoice_id", invoiceIds)
    .order("invoice_id", { ascending: false });

  if (itemError) throw itemError;

  const lastSaleMap: Record<string, string> = {};
  const invoiceDateMap = new Map(invoices?.map(i => [i.id, i.invoice_date]) || []);

  for (const item of items || []) {
    const pid = item.product_id;
    if (!lastSaleMap[pid]) {
      lastSaleMap[pid] = invoiceDateMap.get(item.invoice_id) || "";
    }
  }
  return lastSaleMap;
}

/**
 * Última compra por producto, ignorando compras canceladas.
 * Mismo defecto y misma corrección que `getLastSalePerProduct`.
 */
export async function getLastPurchasePerProduct() {
  const { data, error } = await supabase.rpc("get_last_purchase_per_product");
  if (!error) return rowsToDateMap(data as never, "last_date");
  if (!isAggregationRpcMissing(error)) throw error;
  return getLastPurchasePerProductLegacy();
}

/** Respaldo previo a la RPC. Ver `getLastPurchasePerProduct`. */
async function getLastPurchasePerProductLegacy(): Promise<Record<string, string>> {
  const { data: purchases, error: purError } = await supabase
    .from("purchases")
    .select("id, purchase_date")
    .neq("status", "CANCELLED")
    .order("purchase_date", { ascending: false });

  if (purError) throw purError;

  const purchaseIds = (purchases || []).map(p => p.id);
  if (purchaseIds.length === 0) return {};

  const { data: items, error: itemError } = await supabase
    .from("purchase_items")
    .select("product_id, purchase_id")
    .in("purchase_id", purchaseIds)
    .order("purchase_id", { ascending: false });

  if (itemError) throw itemError;

  const lastPurchaseMap: Record<string, string> = {};
  const purchaseDateMap = new Map(purchases?.map(p => [p.id, p.purchase_date]) || []);

  for (const item of items || []) {
    const pid = item.product_id;
    if (!lastPurchaseMap[pid]) {
      lastPurchaseMap[pid] = purchaseDateMap.get(item.purchase_id) || "";
    }
  }
  return lastPurchaseMap;
}

/**
 * Primera compra por producto, ignorando compras canceladas.
 * Mismo defecto y misma corrección que `getLastSalePerProduct`.
 */
export async function getFirstPurchasePerProduct() {
  const { data, error } = await supabase.rpc("get_first_purchase_per_product");
  if (!error) return rowsToDateMap(data as never, "first_date");
  if (!isAggregationRpcMissing(error)) throw error;
  return getFirstPurchasePerProductLegacy();
}

/** Respaldo previo a la RPC. Ver `getFirstPurchasePerProduct`. */
async function getFirstPurchasePerProductLegacy(): Promise<Record<string, string>> {
  const { data: purchases, error: purError } = await supabase
    .from("purchases")
    .select("id, purchase_date")
    .neq("status", "CANCELLED")
    .order("purchase_date", { ascending: true });

  if (purError) throw purError;

  const purchaseIds = (purchases || []).map(p => p.id);
  if (purchaseIds.length === 0) return {};

  const { data: items, error: itemError } = await supabase
    .from("purchase_items")
    .select("product_id, purchase_id")
    .in("purchase_id", purchaseIds)
    .order("purchase_id", { ascending: true });

  if (itemError) throw itemError;

  const firstPurchaseMap: Record<string, string> = {};
  const purchaseDateMap = new Map(purchases?.map(p => [p.id, p.purchase_date]) || []);

  for (const item of items || []) {
    const pid = item.product_id;
    if (!firstPurchaseMap[pid]) {
      firstPurchaseMap[pid] = purchaseDateMap.get(item.purchase_id) || "";
    }
  }
  return firstPurchaseMap;
}
