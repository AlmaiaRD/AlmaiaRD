import { supabase } from "@/lib/supabase";
import type { Receipt } from "@/types/database";
import { getSettings } from "./settings";
import { updateStageOnPayment } from "./pipeline";

export async function getReceipts() {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, clients(full_name, phone, email), invoices(id, invoice_number, total, amount_paid, balance_due, status, client_id, clients(full_name)), bank_accounts(bank_name, account_number)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateReceipt(id: string, data: Partial<Receipt>) {
  const { error } = await supabase.from("receipts").update(data).eq("id", id);
  if (error) throw error;
}

export async function updateReceiptWithInvoice(id: string, data: Partial<Receipt> & { _old_amount?: number }) {
  const oldAmount = data._old_amount;
  delete data._old_amount;

  const { error } = await supabase.from("receipts").update(data).eq("id", id);
  if (error) throw error;

  if (data.amount !== undefined && oldAmount !== undefined && data.amount !== oldAmount && data.invoice_id) {
    const diff = data.amount - oldAmount;
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("total, amount_paid")
      .eq("id", data.invoice_id)
      .single();
    if (invErr) throw invErr;
    const newPaid = Number(inv.amount_paid) + diff;
    const newBalance = Number(inv.total) - newPaid;
    const newStatus = newBalance <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";
    const { error: updErr } = await supabase
      .from("invoices")
      .update({ amount_paid: newPaid, balance_due: newBalance, status: newStatus })
      .eq("id", data.invoice_id);
    if (updErr) throw updErr;
  }
}

export async function getReceipt(id: string) {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, clients(*), invoices(*, clients(*), bank_accounts(*), invoice_items(*, products(*, subbrands(name)))), bank_accounts(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createReceipt(receipt: Partial<Receipt>) {
  const { data: lastRec } = await supabase
    .from("receipts")
    .select("receipt_number")
    .order("created_at", { ascending: false })
    .limit(1);
  
  const settings = await getSettings().catch(() => null);
  const prefix = settings?.receipt_prefix || "REC-";
  const lastNum = lastRec?.[0]?.receipt_number || `${prefix}000000`;
  const nextNum = parseInt(lastNum.replace(prefix, ""), 10) + 1;
  const receiptNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

  const { data: sessData } = await supabase.auth.getSession();
  const userId = (sessData as any)?.session?.user?.id;

  const { data, error } = await supabase.from("receipts").insert({
    ...receipt,
    receipt_number: receiptNumber,
    created_by: userId,
  }).select().single();
  if (error) throw error;

  // Pipeline automation: move to cierre (ganado)
  if (receipt.client_id) {
    await updateStageOnPayment(receipt.client_id);
  }

  return data as Receipt;
}

export async function deleteReceipt(id: string) {
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) throw error;
}

export async function getClientInvoices(clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, balance_due, status, amount_paid, invoice_date")
    .eq("client_id", clientId)
    .in("status", ["PENDING", "PARTIAL"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClientAllInvoices(clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, total, amount_paid, balance_due, status")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClientReceipts(clientId: string) {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, invoices(invoice_number)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
