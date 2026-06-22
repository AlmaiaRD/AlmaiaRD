import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem } from "@/types/database";
import { getSettings } from "./settings";

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

  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const { data: lastInv } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(1);
  
  const settings = await getSettings().catch(() => null);
  const prefix = settings?.invoice_prefix || "FAC-";
  const lastNum = lastInv?.[0]?.invoice_number || `${prefix}000000`;
  const nextNum = parseInt(lastNum.replace(prefix, ""), 10) + 1;
  const invoiceNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

  const { data: invData, error: invError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      client_id: invoice.client_id,
      invoice_date: new Date().toISOString().split("T")[0],
      status: invoice.status || "PENDING",
      subtotal,
      discount_amount: discount,
      itbis_total: itbisTotal,
      total,
      amount_paid: 0,
      balance_due: total,
      notes: invoice.notes || null,
      bank_account_id: invoice.bank_account_id || null,
      margin: invoice.margin || 30,
      created_by: userId,
    })
    .select()
    .single();
  if (invError) throw invError;

  const itemsWithInvoiceId = items.map((item) => {
    const lineTotal = (item.quantity || 0) * Number(item.unit_price || 0);
    const itbis = item.itbis || false;
    return {
      product_id: item.product_id,
      invoice_id: invData.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: 0,
      line_total: lineTotal,
      pv: (item.pv || 0) * (item.quantity || 0),
      itbis,
      itbis_amount: itbis ? lineTotal * 0.18 : 0,
    };
  });

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
  if (itemsError) throw itemsError;

  return invData;
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>, items: Partial<InvoiceItem>[]) {
  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discount = Number(invoice.discount_amount || 0);
  const itbisTotal = items.reduce((s, i) => s + ((i.itbis ? 1 : 0) * (i.quantity || 0) * Number(i.unit_price || 0) * 0.18), 0);
  const total = subtotal + itbisTotal - discount;

  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      client_id: invoice.client_id,
      invoice_date: invoice.invoice_date || new Date().toISOString().split("T")[0],
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

  const { error: delError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
  if (delError) throw delError;

  if (items.length > 0) {
    const itemsWithInvoiceId = items.map((item) => {
      const lineTotal = (item.quantity || 0) * Number(item.unit_price || 0);
      const itbis = item.itbis || false;
      return {
        product_id: item.product_id,
        invoice_id: id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: 0,
        line_total: lineTotal,
        pv: (item.pv || 0) * (item.quantity || 0),
        itbis,
        itbis_amount: itbis ? lineTotal * 0.18 : 0,
      };
    });
    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId);
    if (itemsError) throw itemsError;
  }
}

export async function updateInvoiceStatus(id: string, status: string) {
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw error;
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
