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

export async function getReceiptsPaginated(page: number, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("receipts")
    .select("*, clients(full_name, phone, email), invoices(id, invoice_number, total, amount_paid, balance_due, status, client_id, clients(full_name)), bank_accounts(bank_name, account_number)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data, total: count || 0, page, pageSize };
}

export async function updateReceipt(id: string, data: Partial<Receipt>) {
  const { error } = await supabase.from("receipts").update(data).eq("id", id);
  if (error) throw error;
}

export async function adjustPayment(invoiceId: string | null | undefined, diff: number) {
  if (!invoiceId || !diff) return;
  const { error } = await supabase.rpc("adjust_invoice_payment", {
    p_invoice_id: invoiceId,
    p_diff: Math.round(diff * 100) / 100,
  });
  if (error) throw error;
}

export async function updateReceiptWithInvoice(id: string, data: Partial<Receipt> & { _old_amount?: number }) {
  // El monto original se lee de la BD, nunca se confía en _old_amount del
  // cliente (evita manipular el diff del pago).
  delete data._old_amount;

  const { data: current } = await supabase
    .from("receipts")
    .select("amount, invoice_id")
    .eq("id", id)
    .single();
  const oldAmount = Number(current?.amount ?? 0);
  const oldInvoiceId = current?.invoice_id ?? null;
  const newAmount = Number(data.amount ?? oldAmount);
  const newInvoiceId = data.invoice_id ?? oldInvoiceId;

  // Calcular credit_excess ANTES de aplicar pagos: lee balance_due de la factura
  // destino (nueva o misma) y calcula excedente = newAmount - balance_due.
  let creditExcess = 0;
  if (newInvoiceId && newAmount > 0) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("id", newInvoiceId)
      .single();
    const balanceDue = Number(inv?.balance_due ?? 0);
    creditExcess = Math.max(0, Math.round((newAmount - balanceDue) * 100) / 100);
  }

  const applied: Array<{ invoice_id: string; diff: number }> = [];
  const apply = async (invoiceId: string, diff: number) => {
    if (!invoiceId || !diff) return;
    await adjustPayment(invoiceId, diff);
    applied.push({ invoice_id: invoiceId, diff });
  };
  const rollback = async () => {
    for (const a of applied.reverse()) {
      try { await adjustPayment(a.invoice_id, -a.diff); } catch { /* intento de reversión */ }
    }
  };

  try {
    if (newInvoiceId && oldInvoiceId && newInvoiceId !== oldInvoiceId) {
      await apply(oldInvoiceId, -oldAmount);
      await apply(newInvoiceId, newAmount);
    } else if (newInvoiceId && newAmount !== oldAmount) {
      await apply(newInvoiceId, newAmount - oldAmount);
    } else if (!newInvoiceId && oldInvoiceId) {
      await apply(oldInvoiceId, -oldAmount);
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  const { error } = await supabase.from("receipts").update({
    ...data,
    credit_excess: creditExcess,
  }).eq("id", id);
  if (error) {
    await rollback();
    throw error;
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
  if (Number(receipt.amount) > 0 && !receipt.invoice_id) {
    throw new Error("Un pago mayor a cero requiere una factura asociada.");
  }

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
  const userId = sessData.session?.user?.id;

  // Calcular credit_excess ANTES de aplicar el pago: lee balance_due actual
  // (que es el saldo pendiente previo) y calcula excedente = amount - balance_due
  let creditExcess = 0;
  if (receipt.invoice_id && Number(receipt.amount) > 0) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("id", receipt.invoice_id)
      .single();
    const balanceDue = Number(inv?.balance_due ?? 0);
    const amount = Number(receipt.amount);
    creditExcess = Math.max(0, Math.round((amount - balanceDue) * 100) / 100);
  }

  // Ajusta el pago en la factura ANTES de crear el recibo: si el RPC falla no
  // queda un recibo sin su pago aplicado. Si luego falla el insert, se revierte.
  const appliedToInvoice = !!receipt.invoice_id && Number(receipt.amount) > 0;
  if (appliedToInvoice) {
    await adjustPayment(receipt.invoice_id, Number(receipt.amount));
  }

  const { data, error } = await supabase.from("receipts").insert({
    ...receipt,
    receipt_number: receiptNumber,
    created_by: userId,
    credit_excess: creditExcess,
  }).select().single();

  if (error) {
    if (appliedToInvoice) {
      try { await adjustPayment(receipt.invoice_id, -Number(receipt.amount)); } catch { /* reversión */ }
    }
    throw error;
  }

  // Pipeline automation: move to cierre (ganado)
  if (receipt.client_id) {
    await updateStageOnPayment(receipt.client_id);
  }

  return data as Receipt;
}

export async function deleteReceipt(id: string) {
  const { data: receipt } = await supabase
    .from("receipts")
    .select("invoice_id, amount")
    .eq("id", id)
    .single();

  const invoiceId = receipt?.invoice_id ?? null;
  const amount = Number(receipt?.amount ?? 0);

  // Ajusta la factura antes de borrar el recibo; si el borrado falla se revierte.
  if (invoiceId && amount > 0) {
    await adjustPayment(invoiceId, -amount);
  }

  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) {
    if (invoiceId && amount > 0) {
      try { await adjustPayment(invoiceId, amount); } catch { /* reversión */ }
    }
    throw error;
  }
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
