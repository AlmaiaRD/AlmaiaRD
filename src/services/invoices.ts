import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem } from "@/types/database";
import { getSettings } from "./settings";
import { subtractInventoryStock, addInventoryStock, restoreInventoryStock } from "./inventory";
import { updateStageOnFirstPurchase } from "./pipeline";
import { getLocalDateString } from "@/lib/utils";

export async function getInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(full_name, phone, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
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
  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discount = Number(invoice.discount_amount || 0);
  const itbisTotal = items.reduce((s, i) => s + ((i.itbis ? 1 : 0) * (i.quantity || 0) * Number(i.unit_price || 0) * 0.18), 0);
  const total = subtotal + itbisTotal - discount;
  const pvTotal = items.reduce((s, i) => s + ((i.pv || 0) * (i.quantity || 0)), 0);

  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

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

  let invData: any;
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
        bank_account_id: invoice.bank_account_id || null,
        margin: invoice.margin || 30,
        created_by: userId,
      })
      .select()
      .single();
    if (data) { invData = data; break; }
    if (invError?.code !== "23505") throw invError;
  }
  if (!invData) throw new Error("No se pudo generar un número de factura único");

  // Fetch product costs to calculate real unit_cost
  const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
  const { data: costData } = await supabase
    .from("products")
    .select("id, cost, apply_itbis")
    .in("id", productIds);
  const costMap: Record<string, { cost: number; apply_itbis: boolean }> = {};
  (costData || []).forEach((p: any) => { costMap[p.id] = { cost: Number(p.cost || 0), apply_itbis: p.apply_itbis !== false }; });

  const itemsWithInvoiceId = items.map((item) => {
    const lineTotal = (item.quantity || 0) * Number(item.unit_price || 0);
    const itbis = item.itbis || false;
    const prod = item.product_id ? costMap[item.product_id] : null;
    const rawCost = prod?.cost || 0;
    const unitCost = prod ? Math.round(rawCost * (prod.apply_itbis ? 1.18 : 1.0) * 100) / 100 : 0;
    return {
      product_id: item.product_id || null,
      invoice_id: invData.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: unitCost,
      line_total: lineTotal,
      pv: (item.pv || 0) * (item.quantity || 0),
      itbis,
      itbis_amount: itbis ? lineTotal * 0.18 : 0,
      custom_name: item.custom_name || null,
    };
  });

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
  if (itemsError) throw itemsError;

  // Subtract inventory for each item sold
  for (const item of items) {
    if (item.product_id) {
      await subtractInventoryStock(item.product_id, item.quantity || 0);
    }
  }

  // Pipeline automation: move to cierre (ganado) if first invoice
  if (invoice.client_id) {
    await updateStageOnFirstPurchase(invoice.client_id);
  }

  return invData;
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>, items: Partial<InvoiceItem>[]) {
  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discount = Number(invoice.discount_amount || 0);
  const itbisTotal = items.reduce((s, i) => s + ((i.itbis ? 1 : 0) * (i.quantity || 0) * Number(i.unit_price || 0) * 0.18), 0);
  const total = subtotal + itbisTotal - discount;
  const pvTotal = items.reduce((s, i) => s + ((i.pv || 0) * (i.quantity || 0)), 0);

  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      client_id: invoice.client_id,
      invoice_date: invoice.invoice_date || getLocalDateString(),
      subtotal,
      discount_amount: discount,
      itbis_total: itbisTotal,
      total,
      amount_paid: invoice.amount_paid || 0,
      balance_due: total - (invoice.amount_paid || 0),
      notes: invoice.notes || null,
      bank_account_id: invoice.bank_account_id || null,
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
    for (const old of oldItems) {
      if (old.product_id) {
        await addInventoryStock(old.product_id, old.quantity, 0, old.line_total);
      }
    }
  }

  const { error: delError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
  if (delError) throw delError;

  if (items.length > 0) {
    // Fetch product costs to calculate real unit_cost
    const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
    const { data: costData } = await supabase
      .from("products")
      .select("id, cost, apply_itbis")
      .in("id", productIds);
    const costMap: Record<string, { cost: number; apply_itbis: boolean }> = {};
    (costData || []).forEach((p: any) => { costMap[p.id] = { cost: Number(p.cost || 0), apply_itbis: p.apply_itbis !== false }; });

    const itemsWithInvoiceId = items.map((item) => {
      const lineTotal = (item.quantity || 0) * Number(item.unit_price || 0);
      const itbis = item.itbis || false;
      const prod = item.product_id ? costMap[item.product_id] : null;
      const rawCost = prod?.cost || 0;
      const unitCost = prod ? Math.round(rawCost * (prod.apply_itbis ? 1.18 : 1.0) * 100) / 100 : 0;
      return {
        product_id: item.product_id || null,
        invoice_id: id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: unitCost,
        line_total: lineTotal,
        pv: (item.pv || 0) * (item.quantity || 0),
        itbis,
        itbis_amount: itbis ? lineTotal * 0.18 : 0,
        custom_name: item.custom_name || null,
      };
    });
    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
    if (itemsError) throw itemsError;

    // Subtract inventory for new items
    for (const item of items) {
      if (item.product_id) {
        await subtractInventoryStock(item.product_id, item.quantity || 0);
      }
    }
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
        for (const item of items) {
          if (item.product_id) {
            await restoreInventoryStock(item.product_id, item.quantity);
          }
        }
      }
    }
  }
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw error;

  // Pipeline automation on payment
  if (status === "PAID") {
    const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", id).single();
    if (inv?.client_id) {
      const { updateStageOnPayment } = await import("./pipeline");
      await updateStageOnPayment(inv.client_id);
    }
  }
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
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

export async function getBankAccounts() {
  const { data, error } = await supabase.from("bank_accounts").select("*").order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}
