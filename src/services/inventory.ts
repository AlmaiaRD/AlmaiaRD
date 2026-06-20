import { supabase } from "@/lib/supabase";
import type { Inventory, InventoryMovement } from "@/types/database";

export async function getInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*, products(name, code, pv, subbrands(name))")
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
  
  return true;
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("product_id", productId);
  
  if (error) throw error;
  
  return true;
}
