import { supabase } from "@/lib/supabase";
import { getSettings } from "./settings";
import { addInventoryStock, subtractInventoryStock } from "./inventory";

const ITBIS_RATE = 0.18;

export async function createPurchase(data: {
  supplier_name?: string;
  purchase_date: string;
  notes?: string;
  discount_amount?: number;
  impuesto_recogida?: number;
  cargo_administracion?: number;
  payment_method?: string;
  bank_account_id?: string;
  items: Array<{ product_id: string; quantity: number; unit_cost: number; itbis?: boolean }>;
}) {
  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const { data: lastPur } = await supabase
    .from("purchases")
    .select("purchase_number")
    .order("created_at", { ascending: false })
    .limit(1);
  
  const settings = await getSettings().catch(() => null);
  const prefix = settings?.purchase_prefix || "COM-";
  const lastNum = lastPur?.[0]?.purchase_number || `${prefix}000000`;
  const nextNum = parseInt(lastNum.replace(prefix, ""), 10) + 1;
  const purchaseNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const itbis = Math.round(data.items.reduce((s, i) => s + ((i.itbis !== false ? 1 : 0) * i.quantity * i.unit_cost * ITBIS_RATE), 0) * 100) / 100;
  const impuestoRecogida = data.impuesto_recogida ?? 36;
  const cargoAdministracion = data.cargo_administracion ?? 200;
  const total = subtotal + impuestoRecogida + cargoAdministracion + itbis - (data.discount_amount || 0);

  const { data: purchase, error: purError } = await supabase
    .from("purchases")
    .insert({
      purchase_number: purchaseNumber,
      supplier_name: data.supplier_name || null,
      purchase_date: data.purchase_date,
      subtotal,
      itbis,
      discount_amount: data.discount_amount || 0,
      impuesto_recogida: impuestoRecogida,
      cargo_administracion: cargoAdministracion,
      total,
      notes: data.notes || null,
      payment_method: data.payment_method || "Efectivo",
      bank_account_id: data.bank_account_id || null,
      status: "COMPLETED",
      created_by: userId,
    })
    .select()
    .single();
  if (purError) throw purError;

  const purchaseItems = data.items.map((item) => {
    const hasItbis = item.itbis !== false;
    return {
      purchase_id: purchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_total: item.quantity * item.unit_cost,
      line_itbis: hasItbis ? Math.round(item.quantity * item.unit_cost * ITBIS_RATE * 100) / 100 : 0,
      itbis: hasItbis,
    };
  });

  const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
  if (itemsError) throw itemsError;

  // Update inventory for each item
  for (const item of data.items) {
    await addInventoryStock(item.product_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost);
  }

  return purchase;
}

export async function getPurchases() {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, purchase_items(*, products(name, code, cost))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPurchase(id: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, purchase_items(*, products(name, code, cost))")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePurchase(
  id: string,
  data: {
    supplier_name?: string;
    purchase_date: string;
    notes?: string;
    discount_amount?: number;
    impuesto_recogida?: number;
    cargo_administracion?: number;
    payment_method?: string;
    bank_account_id?: string;
    items: Array<{ product_id: string; quantity: number; unit_cost: number; itbis?: boolean }>;
  }
) {
  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const itbis = Math.round(data.items.reduce((s, i) => s + ((i.itbis !== false ? 1 : 0) * i.quantity * i.unit_cost * ITBIS_RATE), 0) * 100) / 100;
  const impuestoRecogida = data.impuesto_recogida ?? 36;
  const cargoAdministracion = data.cargo_administracion ?? 200;
  const total = subtotal + impuestoRecogida + cargoAdministracion + itbis - (data.discount_amount || 0);

  const { error: purError } = await supabase
    .from("purchases")
    .update({
      supplier_name: data.supplier_name || null,
      purchase_date: data.purchase_date,
      subtotal,
      itbis,
      discount_amount: data.discount_amount || 0,
      impuesto_recogida: impuestoRecogida,
      cargo_administracion: cargoAdministracion,
      total,
      notes: data.notes || null,
      payment_method: data.payment_method || "Efectivo",
      bank_account_id: data.bank_account_id || null,
      updated_by: userId,
    })
    .eq("id", id);
  if (purError) throw purError;

  // Get old items to subtract from inventory
  const { data: oldItems } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", id);
  if (oldItems) {
    for (const old of oldItems) {
      await subtractInventoryStock(old.product_id, old.quantity);
    }
  }

  const { error: delError } = await supabase
    .from("purchase_items")
    .delete()
    .eq("purchase_id", id);
  if (delError) throw delError;

  const purchaseItems = data.items.map((item) => {
    const hasItbis = item.itbis !== false;
    return {
      purchase_id: id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_total: item.quantity * item.unit_cost,
      line_itbis: hasItbis ? Math.round(item.quantity * item.unit_cost * ITBIS_RATE * 100) / 100 : 0,
      itbis: hasItbis,
    };
  });

  const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
  if (itemsError) throw itemsError;

  // Add new stock to inventory
  for (const item of data.items) {
    await addInventoryStock(item.product_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost);
  }
}

export async function deletePurchase(id: string) {
  // Subtract inventory before deleting
  const { data: oldItems } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", id);
  if (oldItems) {
    for (const old of oldItems) {
      await subtractInventoryStock(old.product_id, old.quantity);
    }
  }

  const { error: itemsError } = await supabase
    .from("purchase_items")
    .delete()
    .eq("purchase_id", id);
  if (itemsError) throw itemsError;

  const { error: purError } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id);
  if (purError) throw purError;
}

export async function getSoldQuantities() {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("product_id, quantity, invoices!inner(status)")
    .neq("invoices.status", "CANCELLED");
  if (error) throw error;
  const map: Record<string, number> = {};
  (data || []).forEach((item: any) => {
    map[item.product_id] = (map[item.product_id] || 0) + item.quantity;
  });
  return map;
}

export async function getPurchasedQuantities() {
  const { data, error } = await supabase
    .from("purchase_items")
    .select("product_id, quantity");
  if (error) throw error;
  const map: Record<string, number> = {};
  (data || []).forEach((item: any) => {
    map[item.product_id] = (map[item.product_id] || 0) + item.quantity;
  });
  return map;
}
