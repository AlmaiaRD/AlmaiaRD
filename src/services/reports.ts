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
  return (data || []).map((inv: any) => ({
    factura: inv.invoice_number,
    fecha: inv.invoice_date,
    cliente: inv.clients?.full_name || "Sin cliente",
    total: Number(inv.total),
    estado: inv.status === "PAID" ? "Pagada" : inv.status === "PENDING" ? "Pendiente" : inv.status === "PARTIAL" ? "Parcial" : inv.status,
  }));
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
  return (data || []).map((rec: any) => ({
    recibo: rec.receipt_number,
    fecha: rec.created_at?.split("T")[0] || "",
    factura: rec.invoices?.invoice_number || "—",
    cliente: rec.clients?.full_name || rec.invoices?.clients?.full_name || "Sin cliente",
    monto: Number(rec.amount),
    metodo: methodLabels[rec.payment_method] || rec.payment_method,
  }));
}

export async function getInventarioReport() {
  const { data, error } = await supabase
    .from("vw_inventory_value")
    .select("product_name, subbrand_name, stock, minimum_stock, stock_status")
    .order("product_name");
  if (error) throw error;
  return (data || []).map((item: any) => ({
    producto: item.product_name,
    submarca: item.subbrand_name || "Sin submarca",
    stock: Number(item.stock),
    minimo: Number(item.minimum_stock),
    estado: item.stock_status === "AGOTADO" ? "Agotado" : item.stock_status === "BAJO" ? "Bajo" : "Óptimo",
  }));
}

export async function getClientesReport() {
  const { data, error } = await supabase
    .from("vw_top_clients")
    .select("client_name, total_invoiced, total_paid, balance_due")
    .order("total_invoiced", { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    cliente: c.client_name,
    total_comprado: Number(c.total_invoiced),
    total_pagado: Number(c.total_paid),
    saldo_pendiente: Number(c.balance_due),
    estado: Number(c.balance_due) > 0 ? "Pendiente" : "Pagado",
  }));
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
  (data || []).forEach((inv: any) => {
    const id = inv.clients?.full_name || "Sin cliente";
    if (!byClient[id]) byClient[id] = { name: id, pv: 0 };
    byClient[id].pv += Number(inv.pv_total || 0);
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
  return (data || []).map((g: any) => ({
    fecha: g.expense_date,
    descripcion: g.concept,
    categoria: g.category,
    subcategoria: g.subcategory || "—",
    monto: Number(g.amount),
  }));
}