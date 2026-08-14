import { supabase } from "@/lib/supabase";
import type { CreditBalance, Receipt, PaymentMethod } from "@/types/database";

export async function getClientCredits(clientId: string) {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("*, receipts(receipt_number, receipt_date)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (CreditBalance & { receipts: { receipt_number: string; receipt_date: string } | null })[];
}

export async function createCreditBalance(credit: Partial<CreditBalance>) {
  const { data, error } = await supabase
    .from("credit_balances")
    .insert(credit)
    .select()
    .single();
  if (error) throw error;
  return data as CreditBalance;
}

export async function applyCreditBalance(creditId: string, amount: number) {
  if (!creditId) throw new Error("Crédito requerido");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");
  const { data, error } = await supabase.rpc("use_credit_balance", {
    p_credit_id: creditId,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function getClientPendingInvoices(clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, balance_due, status, invoice_date")
    .eq("client_id", clientId)
    .in("status", ["PENDING", "PARTIAL"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function applyCreditToInvoice(creditId: string, invoiceId: string, amount: number) {
  if (!creditId || !invoiceId) throw new Error("Crédito y factura requeridos");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");

  // 1) Consumir el crédito (marca USADO, reduce clients.credit_balance)
  const { error: useErr } = await supabase.rpc("use_credit_balance", {
    p_credit_id: creditId,
    p_amount: amount,
  });
  if (useErr) throw useErr;

  // 2) Crear recibo tipo CREDIT aplicado a la factura
  //    createReceipt llama adjustPayment (reduce balance_due) y el trigger recalcula credit_balance
  const { data: creditData } = await supabase
    .from("credit_balances")
    .select("client_id, receipts!inner(client_id)")
    .eq("id", creditId)
    .single<{ client_id: string; receipts: { client_id: string } }>();
  const clientId = creditData?.client_id ?? creditData?.receipts?.client_id;
  if (!clientId) throw new Error("No se pudo determinar el cliente del crédito");

  const { data: settings } = await supabase.from("settings").select("receipt_prefix").single();
  const prefix = settings?.receipt_prefix || "REC-";
  const { data: lastRec } = await supabase
    .from("receipts")
    .select("receipt_number")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastNum = lastRec?.[0]?.receipt_number || `${prefix}000000`;
  const nextNum = parseInt(lastNum.replace(prefix, ""), 10) + 1;
  const receiptNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  // Calcular credit_excess (será 0 porque amount <= balance_due de la factura)
  const { data: inv } = await supabase
    .from("invoices")
    .select("balance_due")
    .eq("id", invoiceId)
    .single();
  const balanceDue = Number(inv?.balance_due ?? 0);
  const creditExcess = Math.max(0, Math.round((amount - balanceDue) * 100) / 100);

  // Aplicar pago a la factura ANTES del insert (patrón createReceipt)
  if (amount > 0) {
    const { error: adjErr } = await supabase.rpc("adjust_invoice_payment", {
      p_invoice_id: invoiceId,
      p_diff: Math.round(amount * 100) / 100,
    });
    if (adjErr) throw adjErr;
  }

  const { data: receipt, error: recErr } = await supabase.from("receipts").insert({
    client_id: clientId,
    invoice_id: invoiceId,
    payment_method: "CREDIT" as PaymentMethod,
    amount,
    amount_in_words: amount.toFixed(2),
    concept: `Aplicación de crédito #${creditId.slice(0, 8)}`,
    receipt_number: receiptNumber,
    created_by: userId,
    credit_excess: creditExcess,
  }).select().single();

  if (recErr) {
    // Revertir ajuste de factura si falla el insert
    try { await supabase.rpc("adjust_invoice_payment", { p_invoice_id: invoiceId, p_diff: -Math.round(amount * 100) / 100 }); } catch {}
    throw recErr;
  }

  return receipt as Receipt;
}

export async function getCreditsSummary() {
  const { data: active, error: activeError } = await supabase
    .from("credit_balances")
    .select("*, clients(full_name, phone)")
    .eq("status", "AVAILABLE")
    .order("created_at", { ascending: false });
  if (activeError) throw activeError;

  const { data: totals, error: totalsError } = await supabase
    .from("credit_balances")
    .select("balance, amount, status");
  if (totalsError) throw totalsError;

  const totalAvailable = totals
    .filter((c: unknown) => (c as Record<string, unknown>).status === "AVAILABLE")
    .reduce((s: number, c: unknown) => s + Number((c as Record<string, unknown>).balance ?? (c as Record<string, unknown>).amount), 0);

  return { active: active, totalAvailable };
}
