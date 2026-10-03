import { supabase } from "@/lib/supabase";
import { nextSequenceNumber, SEQUENCE_DIGITS } from "@/lib/sequences";
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

  const cents = Math.round(amount * 100) / 100;

  // -------------------------------------------------------------------------
  // 1) Consumir el crédito (marca USADO, reduce clients.credit_balance)
  //
  //    Se mantiene en PRIMER lugar a propósito: así el caso habitual de "saldo
  //    insuficiente" falla antes de tocar la factura. El precio es que a partir
  //    de aquí cualquier fallo debe compensarse, y eso es exactamente lo que
    //    hace el envoltorio try/catch de más abajo.
  // -------------------------------------------------------------------------
  const { error: useErr } = await supabase.rpc("use_credit_balance", {
    p_credit_id: creditId,
    p_amount: cents,
  });
  if (useErr) throw useErr;

  let invoiceAdjusted = false;

  /** Deshace los efectos ya aplicados, en orden inverso. */
  const compensate = async () => {
    // a) Reponer el crédito consumido (paso 1).
    try {
      await supabase.rpc("refund_credit_balance", {
        p_credit_id: creditId,
        p_amount: cents,
      });
    } catch { /* best-effort: el error original es el que se propaga */ }
    // b) Revertir el ajuste de la factura, si llegó a aplicarse.
    if (invoiceAdjusted) {
      try {
        await supabase.rpc("adjust_invoice_payment", {
          p_invoice_id: invoiceId,
          p_diff: -cents,
        });
      } catch { /* best-effort */ }
    }
  };

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  try {
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
    const lastNum = lastRec?.[0]?.receipt_number ?? null;
    const receiptNumber = nextSequenceNumber(lastNum, prefix, SEQUENCE_DIGITS);
    if (receiptNumber === null) {
      throw new Error(
        `No se pudo generar el numero de recibo: el ultimo correlativo ` +
          `(${JSON.stringify(lastNum)}) no es interpretable.`
      );
    }

    // Calcular credit_excess (será 0 porque amount <= balance_due de la factura)
    const { data: inv } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("id", invoiceId)
      .single();
    const balanceDue = Number(inv?.balance_due ?? 0);
    const creditExcess = Math.max(0, Math.round((cents - balanceDue) * 100) / 100);

    // Aplicar pago a la factura ANTES del insert (patrón createReceipt)
    if (cents > 0) {
      const { error: adjErr } = await supabase.rpc("adjust_invoice_payment", {
        p_invoice_id: invoiceId,
        p_diff: cents,
      });
      if (adjErr) throw adjErr;
      invoiceAdjusted = true;
    }

    const { data: receipt, error: recErr } = await supabase.from("receipts").insert({
      client_id: clientId,
      invoice_id: invoiceId,
      payment_method: "CREDIT" as PaymentMethod,
      amount: cents,
      amount_in_words: cents.toFixed(2),
      concept: `Aplicación de crédito #${creditId.slice(0, 8)}`,
      receipt_number: receiptNumber,
      created_by: userId,
      credit_excess: creditExcess,
    }).select().single();

    if (recErr) throw recErr;

    return receipt as Receipt;
  } catch (e) {
    // Antes: sólo se revertía el paso 5 y el crédito del paso 1 se perdía.
    await compensate();
    throw e;
  }
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
