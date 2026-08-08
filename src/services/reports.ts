import { supabase } from "@/lib/supabase";

export async function getVentasReport(from?: string, to?: string) {
  let query = supabase
    .from("invoices")
    .select("invoice_number, invoice_date, total, status, clients(full_name)")
    .not("status", "eq", "CANCELLED")
    .order("invoice_date", { ascending: false });
  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((inv: unknown) => {
    const i = inv as Record<string, unknown>;
    const clients = i.clients as Record<string, unknown> | null;
    return {
      factura: i.invoice_number,
      fecha: i.invoice_date,
      cliente: clients?.full_name || "Sin cliente",
      total: Number(i.total),
      estado: i.status === "PAID" ? "Pagada" : i.status === "PENDING" ? "Pendiente" : i.status === "PARTIAL" ? "Parcial" : (i.status as string),
    };
  });
}

export async function getCobrosReport(from?: string, to?: string) {
  let query = supabase
    .from("receipts")
    .select("receipt_number, created_at, amount, payment_method, clients(full_name), invoices!inner(invoice_number, clients(full_name))")
    .order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");
  const { data, error } = await query;
  if (error) throw error;
  const methodLabels: Record<string, string> = { CASH: "Efectivo", TRANSFER: "Transferencia", CARD: "Tarjeta" };
  return (data || []).map((rec: unknown) => {
    const r = rec as Record<string, unknown>;
    const clients = r.clients as Record<string, unknown> | null;
    const invoices = r.invoices as Record<string, unknown> | null;
    const invClients = invoices?.clients as Record<string, unknown> | null;
    return {
      recibo: r.receipt_number,
      fecha: (r.created_at as string)?.split("T")[0] || "",
      factura: (invoices?.invoice_number as string) || "—",
      cliente: clients?.full_name as string || invClients?.full_name as string || "Sin cliente",
      monto: Number(r.amount),
      metodo: methodLabels[r.payment_method as string] || (r.payment_method as string),
    };
  });
}

export async function getInventarioReport() {
  const { data, error } = await supabase
    .from("vw_inventory_value")
    .select("product_name, stock, minimum_stock, stock_status")
    .order("product_name");
  if (error) throw error;
  return (data || []).map((item: unknown) => {
    const i = item as Record<string, unknown>;
    return {
      producto: i.product_name,
      submarca: "—",
      stock: Number(i.stock),
      minimo: Number(i.minimum_stock),
      estado: i.stock_status === "AGOTADO" ? "Agotado" : i.stock_status === "BAJO" ? "Bajo" : "Óptimo",
    };
  });
}

export async function getClientesReport() {
  const { data, error } = await supabase
    .from("vw_accounts_receivable")
    .select("client_name, total_invoiced, total_paid, balance_due, credit_balance");
  if (error) throw error;
  return (data || []).map((c: unknown) => {
    const cc = c as Record<string, unknown>;
    return {
      cliente: cc.client_name,
      total_comprado: Number(cc.total_invoiced),
      total_pagado: Number(cc.total_paid),
      saldo_pendiente: Number(cc.balance_due),
      estado: Number(cc.balance_due) > 0 ? "Pendiente" : "Pagado",
    };
  });
}

export async function getPvReport(from?: string, to?: string) {
  let query = supabase
    .from("invoices")
    .select("pv_total, invoice_date, clients(full_name)")
    .not("status", "eq", "CANCELLED")
    .order("invoice_date", { ascending: false });
  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);
  const { data, error } = await query;
  if (error) throw error;

  const byClient: Record<string, { name: string; pv: number }> = {};
  (data || []).forEach((inv: unknown) => {
    const i = inv as Record<string, unknown>;
    const clients = i.clients as Record<string, unknown> | null;
    const id = clients?.full_name || "Sin cliente";
    if (!byClient[id as string]) byClient[id as string] = { name: id as string, pv: 0 };
    byClient[id as string].pv += Number(i.pv_total || 0);
  });

  return Object.values(byClient).map((c) => ({
    cliente: c.name,
    pv_generado: c.pv,
    comision: c.pv * 20,
  }));
}

export async function getGastosReport(from?: string, to?: string) {
  let query = supabase
    .from("expenses")
    .select("expense_date, concept, category, amount, subcategory")
    .order("expense_date", { ascending: false });
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((g: unknown) => {
    const gg = g as Record<string, unknown>;
    return {
      fecha: gg.expense_date,
      descripcion: gg.concept,
      categoria: gg.category,
      subcategoria: gg.subcategory || "—",
      monto: Number(gg.amount),
    };
  });
}