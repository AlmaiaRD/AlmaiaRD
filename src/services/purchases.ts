import { supabase } from "@/lib/supabase";
import { getSettings } from "./settings";
import { addInventoryStock, subtractInventoryStock } from "./inventory";
import { ITBIS_RATE } from "@/lib/constants";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

type PurchaseData = {
  supplier_name?: string;
  purchase_date: string;
  notes?: string;
  discount_amount?: number;
  impuesto_recogida?: number;
  cargo_administracion?: number;
  payment_method?: string;
  bank_account_id?: string;
  items: Array<{ product_id: string; quantity: number; unit_cost: number; itbis?: boolean }>;
};

function computePurchaseTotals(data: PurchaseData) {
  const items = data.items || [];
  const subtotal = round2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0));
  const itbis = round2(items.reduce((s, i) => s + ((i.itbis !== false ? 1 : 0) * (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0) * ITBIS_RATE), 0));
  const impuestoRecogida = round2(Number(data.impuesto_recogida) || 36);
  const cargoAdministracion = round2(Number(data.cargo_administracion) || 200);
  const discount = round2(Number(data.discount_amount) || 0);
  const total = round2(subtotal + impuestoRecogida + cargoAdministracion + itbis - discount);
  return { subtotal, itbis, impuestoRecogida, cargoAdministracion, discount, total };
}

function buildPurchaseItems(purchaseId: string, items: PurchaseData["items"]) {
  return (items || []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitCost = round2(Number(item.unit_cost) || 0);
    const hasItbis = item.itbis !== false;
    return {
      purchase_id: purchaseId,
      product_id: item.product_id || null,
      quantity,
      unit_cost: unitCost,
      line_total: round2(quantity * unitCost),
      line_itbis: hasItbis ? round2(quantity * unitCost * ITBIS_RATE) : 0,
      itbis: hasItbis,
    };
  });
}

export async function createPurchase(data: PurchaseData) {
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const { data: lastPur } = await supabase
    .from("purchases")
    .select("purchase_number")
    .order("created_at", { ascending: false })
    .limit(1);

  const settings = await getSettings().catch(() => null);
  const prefix = settings?.purchase_prefix || "COM-";
  const lastNum = lastPur?.[0]?.purchase_number || `${prefix}000000`;
  const numPart = parseInt(lastNum.replace(prefix, ""), 10);
  const nextNum = isNaN(numPart) ? 1 : numPart + 1;
  const purchaseNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

  const { subtotal, itbis, impuestoRecogida, cargoAdministracion, discount, total } = computePurchaseTotals(data);

  const { data: purchase, error: purError } = await supabase
    .from("purchases")
    .insert({
      purchase_number: purchaseNumber,
      supplier_name: data.supplier_name || null,
      purchase_date: data.purchase_date,
      subtotal,
      itbis,
      discount_amount: discount,
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

  const purchaseItems = buildPurchaseItems(purchase.id, data.items);
  const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
  if (itemsError) {
    // Rollback: no dejar una compra sin sus items.
    await supabase.from("purchases").delete().eq("id", purchase.id);
    throw itemsError;
  }

  // Update inventory for each item
  try {
    for (const item of data.items) {
      const quantity = Number(item.quantity) || 0;
      const unitCost = round2(Number(item.unit_cost) || 0);
      await addInventoryStock(item.product_id, quantity, unitCost, round2(quantity * unitCost), "PURCHASE", "purchase", purchase.id);
    }
  } catch (e) {
    await supabase.from("purchase_items").delete().eq("purchase_id", purchase.id);
    await supabase.from("purchases").delete().eq("id", purchase.id);
    throw e;
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

export async function updatePurchase(id: string, data: PurchaseData) {
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const { subtotal, itbis, impuestoRecogida, cargoAdministracion, discount, total } = computePurchaseTotals(data);

  // Old items (para revertir stock) ANTES de tocar nada.
  const { data: oldItems } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", id);

  // 1) Reemplaza los items primero (rollback si falla).
  const { error: delError } = await supabase
    .from("purchase_items")
    .delete()
    .eq("purchase_id", id);
  if (delError) throw delError;

  const purchaseItems = buildPurchaseItems(id, data.items);
  const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
  if (itemsError) {
    if (oldItems) {
      await supabase.from("purchase_items").insert(
        oldItems.map((o) => ({
          purchase_id: id,
          product_id: o.product_id,
          quantity: o.quantity,
          unit_cost: o.unit_cost,
          line_total: o.line_total,
          line_itbis: o.line_itbis,
          itbis: o.itbis,
        }))
      );
    }
    throw itemsError;
  }

  // 2) Actualiza totales de la compra (rollback de items si falla).
  const { error: purError } = await supabase
    .from("purchases")
    .update({
      supplier_name: data.supplier_name || null,
      purchase_date: data.purchase_date,
      subtotal,
      itbis,
      discount_amount: discount,
      impuesto_recogida: impuestoRecogida,
      cargo_administracion: cargoAdministracion,
      total,
      notes: data.notes || null,
      payment_method: data.payment_method || "Efectivo",
      bank_account_id: data.bank_account_id || null,
      updated_by: userId,
    })
    .eq("id", id);
  if (purError) {
    await supabase.from("purchase_items").delete().eq("purchase_id", id);
    if (oldItems) {
      await supabase.from("purchase_items").insert(
        oldItems.map((o) => ({
          purchase_id: id,
          product_id: o.product_id,
          quantity: o.quantity,
          unit_cost: o.unit_cost,
          line_total: o.line_total,
          line_itbis: o.line_itbis,
          itbis: o.itbis,
        }))
      );
    }
    throw purError;
  }

  // 3) Ajusta inventario: revierte el stock viejo y suma el nuevo.
  if (oldItems) {
    for (const old of oldItems) {
      await subtractInventoryStock(old.product_id, old.quantity, "ADJUSTMENT", "purchase", id);
    }
  }
  for (const item of data.items) {
    const quantity = Number(item.quantity) || 0;
    const unitCost = round2(Number(item.unit_cost) || 0);
    await addInventoryStock(item.product_id, quantity, unitCost, round2(quantity * unitCost), "PURCHASE", "purchase", id);
  }
}

export async function deletePurchase(id: string) {
  const { data: oldItems } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", id);

  // Borra la compra (items en cascada) y solo después revierte el stock:
  // antes el stock se restaba aunque el borrado fallara.
  const { error: purError } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id);
  if (purError) throw purError;

  if (oldItems) {
    for (const old of oldItems) {
      await subtractInventoryStock(old.product_id, old.quantity, "ADJUSTMENT", "purchase", id);
    }
  }
}

export async function getSoldQuantities() {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("product_id, quantity, invoices!inner(status)")
    .neq("invoices.status", "CANCELLED");
  if (error) throw error;
  const map: Record<string, number> = {};
  (data || []).forEach((item: { product_id: string; quantity: number }) => {
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
  (data || []).forEach((item: { product_id: string; quantity: number }) => {
    map[item.product_id] = (map[item.product_id] || 0) + item.quantity;
  });
  return map;
}
