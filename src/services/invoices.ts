import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem } from "@/types/database";
import { getSettings } from "./settings";
import { subtractInventoryStock, addInventoryStock, restoreInventoryStock } from "./inventory";
import { getBundleComponentMap } from "./products";
import { updateStageOnFirstPurchase, updateStageOnPayment } from "./pipeline";
import { getLocalDateString } from "@/lib/utils";
import { computeInvoiceMath } from "@/lib/invoiceMath";

const round2 = (n: number) => Math.round(n * 100) / 100;

type InventoryOp = "SALE" | "CANCELLATION" | "RETURN";

async function getItemsComponentMap(items: Array<{ product_id?: string | null }>) {
  const ids = [...new Set(items.map(i => i.product_id).filter(Boolean) as string[])];
  return getBundleComponentMap(ids);
}

/**
 * Valida stock de los COMPONENTES de los bundles antes de facturar.
 * Solo bloquea si existe fila de inventario con stock insuficiente; los
 * productos sin tracking no se bloquean (se comportan como ilimitados).
 */
async function validateBundleStock(items: Array<{ product_id?: string | null; quantity?: number | null }>) {
  const compMap = await getItemsComponentMap(items);
  const totalNeeded = new Map<string, number>();
  const compNames = new Map<string, string>();
  for (const item of items) {
    if (!item.product_id) continue;
    const comps = compMap.get(item.product_id);
    const qty = Number(item.quantity || 0);
    if (!comps || comps.length === 0) continue;
    for (const c of comps) {
      totalNeeded.set(c.product_id, (totalNeeded.get(c.product_id) || 0) + qty * c.quantity);
      if (!compNames.has(c.product_id)) compNames.set(c.product_id, c.name || c.product_id);
    }
  }
  if (totalNeeded.size === 0) return;
  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, stock")
    .in("product_id", [...totalNeeded.keys()]);
  if (error) throw error;
  const stockMap = new Map((data || []).map((r: any) => [r.product_id, Number(r.stock || 0)]));
  for (const [pid, need] of totalNeeded) {
    const stock = stockMap.get(pid);
    if (stock != null && stock < need) {
      throw new Error(`Stock insuficiente de "${compNames.get(pid) || pid}" (se necesitan ${need}, hay ${stock}).`);
    }
  }
}

/**
 * Aplica el movimiento de inventario de una factura. Los bundles descuentan/
 * restituyen el stock de cada componente multiplicado por la cantidad del bundle;
 * los productos normales se procesan como antes.
 */
async function applyInvoiceInventory(
  items: Array<{ product_id?: string | null; quantity?: number | null; line_total?: number | null }>,
  referenceId: string,
  op: InventoryOp
) {
  const compMap = await getItemsComponentMap(items);
  for (const item of items) {
    if (!item.product_id) continue;
    const comps = compMap.get(item.product_id);
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;
    if (comps && comps.length > 0) {
      for (const c of comps) {
        const totalQty = qty * c.quantity;
        if (op === "SALE") await subtractInventoryStock(c.product_id, totalQty, "SALE", "invoice", referenceId);
        else if (op === "CANCELLATION") await restoreInventoryStock(c.product_id, totalQty, "CANCELLATION", "invoice", referenceId);
        else await addInventoryStock(c.product_id, totalQty, 0, 0, "RETURN", "invoice", referenceId);
      }
    } else if (op === "SALE") {
      await subtractInventoryStock(item.product_id, qty, "SALE", "invoice", referenceId);
    } else if (op === "CANCELLATION") {
      await restoreInventoryStock(item.product_id, qty, "CANCELLATION", "invoice", referenceId);
    } else {
      await addInventoryStock(item.product_id, qty, 0, Number(item.line_total || 0), "RETURN", "invoice", referenceId);
    }
  }
}

export async function getInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(full_name, phone, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvoicesPaginated(page: number, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("invoices")
    .select("*, clients(full_name, phone, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data, total: count || 0, page, pageSize };
}

export async function getInvoice(id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(*), invoice_items(*, products(*, subbrands(name))), bank_accounts(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createInvoice(invoice: Partial<Invoice>, items: Partial<InvoiceItem>[]) {
  if (!invoice.client_id) throw new Error("La factura requiere un cliente.");

  // Fetch product costs: el ITBIS de la factura se calcula SIEMPRE sobre el
  // costo base del producto (no sobre el margen), y unit_cost guarda ese costo.
  const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
  const { data: costData } = await supabase
    .from("products")
    .select("id, cost, apply_itbis")
    .in("id", productIds);
  const costMap: Record<string, { cost: number; apply_itbis: boolean }> = {};
  (costData || []).forEach((p: { id: string; cost: number | null; apply_itbis: boolean | null }) => { costMap[p.id] = { cost: Number(p.cost || 0), apply_itbis: p.apply_itbis !== false }; });

  const discount = round2(Number(invoice.discount_amount || 0));
  const math = computeInvoiceMath(items.map(i => ({
    quantity: i.quantity || 0,
    unit_price: Number(i.unit_price || 0),
    itbis: !!i.itbis,
    cost: i.product_id ? (costMap[i.product_id]?.cost ?? Number(i.unit_cost || 0)) : Number(i.unit_cost || 0),
  })), discount);
  const subtotal = math.subtotal;
  const itbisTotal = math.itbis_total;
  const total = math.total;
  const pvTotal = items.reduce((s, i) => s + ((i.pv || 0) * (i.quantity || 0)), 0);

  // Valida stock de componentes de bundles ANTES de crear la factura
  await validateBundleStock(items);

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const settings = await getSettings().catch(() => null);
  const prefix = settings?.invoice_prefix || "FAC-";

  const { data: invs } = await supabase
    .from("invoices")
    .select("invoice_number")
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  let nextNum = 1;
  if (invs?.[0]?.invoice_number) {
    const numPart = parseInt(invs[0].invoice_number.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  let invData: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const num = attempt > 0 ? ++nextNum : nextNum;
    const { data, error: invError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: `${prefix}${String(num).padStart(6, "0")}`,
        client_id: invoice.client_id,
        invoice_date: invoice.invoice_date || getLocalDateString(),
        status: invoice.status || "PENDING",
        subtotal,
        discount_amount: discount,
        itbis_total: itbisTotal,
        total,
        pv_total: pvTotal,
        amount_paid: 0,
        balance_due: total,
        notes: invoice.notes || null,
        bank_account_id: invoice.show_all_bank_accounts ? null : (invoice.bank_account_id || null),
        show_all_bank_accounts: invoice.show_all_bank_accounts || false,
        margin: invoice.margin || 30,
        created_by: userId,
      })
      .select()
      .single();
    if (data) { invData = data; break; }
    if (invError?.code !== "23505") throw invError;
  }
  if (!invData) throw new Error("No se pudo generar un número de factura único");

  // Build items with the adjusted price from the line math
  const itemsWithInvoiceId = items.map((item, idx) => {
    const line = math.lines[idx] || { unit_price: Number(item.unit_price || 0), line_total: 0, itbis_amount: 0 };
    const itbis = item.itbis || false;
    const prod = item.product_id ? costMap[item.product_id] : null;
    const unitCost = prod?.cost || 0;
    return {
      product_id: item.product_id || null,
      invoice_id: (invData as Record<string, unknown>).id as string,
      quantity: item.quantity,
      unit_price: line.unit_price,
      unit_cost: unitCost,
      line_total: line.line_total,
      pv: (item.pv || 0) * (item.quantity || 0),
      itbis,
      itbis_amount: line.itbis_amount,
      custom_name: item.custom_name || null,
    };
  });

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
  if (itemsError) throw itemsError;

  // Subtract inventory for each item sold
  const invId = (invData as Record<string, unknown>).id as string;
  await applyInvoiceInventory(items, invId, "SALE");

  // Pipeline automation: move to cierre (ganado) if first invoice
  if (invoice.client_id) {
    await updateStageOnFirstPurchase(invoice.client_id);
  }

  return invData;
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>, items: Partial<InvoiceItem>[]) {
  const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
  const { data: costData } = await supabase
    .from("products")
    .select("id, cost, apply_itbis")
    .in("id", productIds);
  const costMap: Record<string, { cost: number; apply_itbis: boolean }> = {};
  (costData || []).forEach((p: unknown) => { const pp = p as Record<string, unknown>; costMap[pp.id as string] = { cost: Number(pp.cost || 0), apply_itbis: pp.apply_itbis !== false }; });

  const discount = round2(Number(invoice.discount_amount || 0));
  const math = computeInvoiceMath(items.map(i => ({
    quantity: i.quantity || 0,
    unit_price: Number(i.unit_price || 0),
    itbis: !!i.itbis,
    cost: i.product_id ? (costMap[i.product_id]?.cost ?? Number(i.unit_cost || 0)) : Number(i.unit_cost || 0),
  })), discount);
  const subtotal = math.subtotal;
  const itbisTotal = math.itbis_total;
  const total = math.total;
  const pvTotal = items.reduce((s, i) => s + ((i.pv || 0) * (i.quantity || 0)), 0);

  // Valida stock de componentes de bundles ANTES de actualizar la factura
  await validateBundleStock(items);

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  // Preserva el estado y lo ya pagado al editar: si el UI no los envía, se
  // mantienen los valores actuales (antes amount_paid se reseteaba a 0 y el
  // status se forzaba a PENDING al re-guardar una factura).
  const { data: existing } = await supabase
    .from("invoices")
    .select("amount_paid, status")
    .eq("id", id)
    .single();
  const amountPaid = round2(Number(invoice.amount_paid ?? existing?.amount_paid ?? 0));
  const status = invoice.status ?? existing?.status ?? "PENDING";

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      client_id: invoice.client_id,
      invoice_date: invoice.invoice_date || getLocalDateString(),
      subtotal,
      discount_amount: discount,
      itbis_total: itbisTotal,
      total,
      pv_total: pvTotal,
      status,
      amount_paid: amountPaid,
      balance_due: round2(Math.max(total - amountPaid, 0)),
      notes: invoice.notes || null,
      bank_account_id: invoice.show_all_bank_accounts ? null : (invoice.bank_account_id || null),
      show_all_bank_accounts: invoice.show_all_bank_accounts || false,
      margin: invoice.margin || 30,
      updated_by: userId,
    })
    .eq("id", id);
  if (invError) throw invError;

  // Restore inventory from old items
  const { data: oldItems } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id);
  if (oldItems) {
    await applyInvoiceInventory(
      oldItems.map((old) => ({ product_id: old.product_id, quantity: old.quantity, line_total: old.line_total })),
      id,
      "RETURN"
    );
  }

  const { error: delError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
  if (delError) throw delError;

  if (items.length > 0) {
    const itemsWithInvoiceId = items.map((item, idx) => {
      const line = math.lines[idx] || { unit_price: Number(item.unit_price || 0), line_total: 0, itbis_amount: 0 };
      const itbis = item.itbis || false;
      const prod = item.product_id ? costMap[item.product_id] : null;
      const unitCost = prod?.cost || 0;
      return {
        product_id: item.product_id || null,
        invoice_id: id,
        quantity: item.quantity,
        unit_price: line.unit_price,
        unit_cost: unitCost,
        line_total: line.line_total,
        pv: (item.pv || 0) * (item.quantity || 0),
        itbis,
        itbis_amount: line.itbis_amount,
        custom_name: item.custom_name || null,
      };
    });
    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
    if (itemsError) throw itemsError;

    // Subtract inventory for new items
    await applyInvoiceInventory(items, id, "SALE");
  }

  // Pipeline automation: move to cierre (ganado) if first invoice
  if (invoice.client_id) {
    await updateStageOnFirstPurchase(invoice.client_id);
  }
}

export async function updateInvoiceStatus(id: string, status: string) {
  if (status === "CANCELLED") {
    const { data: oldInvoice } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", id)
      .single();
    if (oldInvoice && oldInvoice.status !== "CANCELLED") {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, line_total")
        .eq("invoice_id", id);
      if (items) {
        await applyInvoiceInventory(
          items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, line_total: item.line_total })),
          id,
          "CANCELLATION"
        );
      }
    }
  }
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw error;

  // Pipeline automation on payment
  if (status === "PAID") {
    const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", id).single();
    if (inv?.client_id) {
      await updateStageOnPayment(inv.client_id);
    }
  }
}

export async function deleteInvoice(id: string) {
  // No se puede borrar una factura que ya tiene pagos: la FK de receipts es
  // RESTRICT, así que validamos antes para dar un mensaje claro.
  const { data: receipts, error: recError } = await supabase
    .from("receipts")
    .select("id")
    .eq("invoice_id", id)
    .limit(1);
  if (recError) throw recError;
  if (receipts && receipts.length > 0) {
    throw new Error("Esta factura tiene pagos registrados. Elimina primero los recibos asociados.");
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("product_id, quantity, line_total")
    .eq("invoice_id", id);

  // Primero borra la factura (los items se borran en cascada); solo si el
  // borrado tuvo éxito se restituye el stock. Antes el stock se reponía
  // aunque el borrado fallara.
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;

  if (items && items.length > 0) {
    await applyInvoiceInventory(
      items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, line_total: item.line_total })),
      id,
      "CANCELLATION"
    );
  }
}

export async function searchInvoices(query: string) {
  const { data: byNumber, error: err1 } = await supabase
    .from("invoices")
    .select("*, clients(full_name, phone, email)")
    .ilike("invoice_number", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (err1) throw err1;

  const { data: byClient, error: err2 } = await supabase
    .from("invoices")
    .select("*, clients!inner(full_name, phone, email)")
    .ilike("clients.full_name", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (err2) throw err2;

  const merged = [...(byNumber || []), ...(byClient || [])];
  const seen = new Set<string>();
  return merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export { getBankAccounts } from "./settings";
