import { supabase } from "@/lib/supabase";
import { getLocalDateString } from "@/lib/utils";

export async function getDashboardStats() {
  const { data: sales, error: salesError } = await supabase
    .from("vw_sales_summary")
    .select("*")
    .single();
  if (salesError) throw salesError;

  const { data: ar, error: arError } = await supabase
    .from("vw_accounts_receivable")
    .select("*");
  if (arError) throw arError;

  // Cobros Recibidos: sum of receipts for current month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: receipts } = await supabase
    .from("receipts")
    .select("amount")
    .gte("created_at", monthStart.toISOString());
  const totalPaidReceipts = (receipts || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

  // Ventas del Mes: sum invoice totals for current month using local date
  const localMonthStart = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const { data: monthInvoices } = await supabase
    .from("invoices")
    .select("total")
    .gte("invoice_date", localMonthStart)
    .neq("status", "CANCELLED");
  const salesMonthLocal = (monthInvoices || []).reduce((s: number, inv: any) => s + Number(inv.total), 0);

  // Valor de inventario: stock × cost × (apply_itbis ? 1.35 : 1.0)
  const { data: invFull } = await supabase
    .from("inventory")
    .select("stock, products(cost, apply_itbis)");
  const inventoryValue = (invFull || []).reduce((sum: number, i: any) => {
    const stock = Number(i.stock || 0);
    const cost = Number(i.products?.cost || 0);
    const applyItbis = i.products?.apply_itbis !== false;
    const markup = applyItbis ? 1.35 : 1.0;
    return sum + stock * cost * markup;
  }, 0);

  const totalStock = (invFull || []).reduce((sum: number, i: any) => sum + Number(i.stock || 0), 0);

  // Low stock / out of stock
  const { data: lowStockData } = await supabase
    .from("vw_inventory_value")
    .select("*");
  const lowStock = (lowStockData || []).filter((i: any) => i.stock_status === "BAJO").length;
  const outOfStock = (lowStockData || []).filter((i: any) => i.stock_status === "AGOTADO").length;

  const { data: profitability, error: profError } = await supabase
    .from("vw_profitability")
    .select("*")
    .single();
  if (profError) throw profError;

  // PV del Mes: sum pv from invoice_items for current month (non-cancelled invoices)
  const { data: pvData } = await supabase
    .from("invoice_items")
    .select("pv, invoices!inner(status, invoice_date)")
    .gte("invoices.invoice_date", localMonthStart)
    .neq("invoices.status", "CANCELLED");
  const pvMonth = (pvData || []).reduce((s: number, ii: any) => s + Number(ii.pv || 0), 0);

  const totalPending = ar.reduce((sum: number, r: any) => sum + Number(r.total_pending), 0);

  return {
    salesToday: sales?.sales_today ?? 0,
    salesMonth: salesMonthLocal,
    salesYear: sales?.sales_year ?? 0,
    totalSales: sales?.total_sales ?? 0,
    totalPending,
    totalPaid: totalPaidReceipts,
    inventoryValue,
    totalStock,
    lowStock,
    outOfStock,
    grossProfit: profitability?.gross_profit ?? 0,
    realProfit: profitability?.real_profit ?? 0,
    pvMonth,
    pvYear: 0,
  };
}

export async function getRecentActivity() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}
