import { supabase } from "@/lib/supabase";
import type { Inventory, InventoryMovement } from "@/types/database";

export async function getInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*, products(name, code, pv, cost, subbrands(name))")
    .order("products(name)");
  if (error) throw error;
  return data;
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
    .lte("stock", supabase.rpc("get_minimum_stock_column"))
    .order("stock");
  if (error) throw error;
  return data;
}

export async function addInventoryStock(productId: string, quantity: number, unitCost: number, lineTotal: number) {
  const { data: existing } = await supabase
    .from("inventory")
    .select("stock, average_cost, inventory_value, pending_return")
    .eq("product_id", productId)
    .single();

  if (existing) {
    const pending = existing.pending_return || 0;
    const fulfillReturn = Math.min(pending, quantity);
    const newPending = pending - fulfillReturn;
    const newStock = existing.stock + (quantity - fulfillReturn);
    const newAvgCost = existing.stock > 0
      ? ((existing.average_cost * existing.stock) + (quantity * unitCost)) / (existing.stock + quantity)
      : unitCost;
    const newValue = (existing.inventory_value || 0) + lineTotal;
    const { error } = await supabase
      .from("inventory")
      .update({
        stock: newStock,
        pending_return: newPending,
        average_cost: Math.round(newAvgCost * 100) / 100,
        inventory_value: Math.round(newValue * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("inventory")
      .insert({ product_id: productId, stock: quantity, pending_return: 0, average_cost: unitCost, inventory_value: lineTotal });
    if (error) throw error;
  }
}

export async function subtractInventoryStock(productId: string, quantity: number) {
  const { data: existing } = await supabase
    .from("inventory")
    .select("stock, inventory_value, pending_return")
    .eq("product_id", productId)
    .single();

  if (existing) {
    const newStock = Math.max(0, existing.stock - quantity);
    const shortfall = quantity - (existing.stock - newStock);
    const newPending = (existing.pending_return || 0) + shortfall;
    const { error } = await supabase
      .from("inventory")
      .update({
        stock: newStock,
        pending_return: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("inventory")
      .insert({ product_id: productId, stock: 0, pending_return: quantity, inventory_value: 0, minimum_stock: 3 });
    if (error) throw error;
  }
}

export async function restoreInventoryStock(productId: string, quantity: number) {
  const { data: existing } = await supabase
    .from("inventory")
    .select("stock, pending_return")
    .eq("product_id", productId)
    .single();

  if (existing) {
    const pending = existing.pending_return || 0;
    const fulfillReturn = Math.min(pending, quantity);
    const newPending = pending - fulfillReturn;
    const newStock = existing.stock + (quantity - fulfillReturn);
    await supabase
      .from("inventory")
      .update({ stock: newStock, pending_return: newPending, updated_at: new Date().toISOString() })
      .eq("product_id", productId);
  } else {
    await supabase
      .from("inventory")
      .insert({ product_id: productId, stock: quantity, pending_return: 0, minimum_stock: 3, inventory_value: 0 });
  }
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
  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("product_id", productId);
  
  if (error) throw error;
  
  return true;
}

export async function forceDeleteProduct(productId: string) {
  // Delete all related records, then the inventory record itself
  await supabase.from("inventory_movements").delete().eq("product_id", productId);
  await supabase.from("invoice_items").delete().eq("product_id", productId);
  await supabase.from("purchase_items").delete().eq("product_id", productId);
  const { error } = await supabase.from("inventory").delete().eq("product_id", productId);
  if (error) throw error;
  return true;
}

export async function getLastSalePerProduct() {
  // First get non-cancelled invoices, then get their items
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

export async function getLastPurchasePerProduct() {
  // First get non-cancelled purchases, then get their items
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

export async function getFirstPurchasePerProduct() {
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
