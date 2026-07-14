import { supabase } from "@/lib/supabase";
import { getLocalDateString } from "@/lib/utils";

export async function getDashboardStats() {
  const localMonthStart = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [
    salesResult,
    arResult,
    receiptsResult,
    monthInvoicesResult,
    inventoryResult,
    lowStockResult,
    profitResult,
    pvResult,
  ] = await Promise.all([
    supabase.from("vw_sales_summary").select("*").single(),
    supabase.from("vw_accounts_receivable").select("*"),
    supabase.from("receipts").select("amount").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("invoices").select("total").gte("invoice_date", localMonthStart).neq("status", "CANCELLED"),
    supabase.from("inventory").select("stock, products(cost, apply_itbis)"),
    supabase.from("vw_inventory_value").select("*"),
    supabase.from("vw_profitability").select("*").single(),
    supabase.from("invoice_items").select("pv, invoices!inner(status, invoice_date)").gte("invoices.invoice_date", localMonthStart).neq("invoices.status", "CANCELLED"),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (arResult.error) throw arResult.error;
  if (profitResult.error) throw profitResult.error;

  const sales = salesResult.data;
  const ar = arResult.data || [];
  const receipts = receiptsResult.data || [];
  const monthInvoices = monthInvoicesResult.data || [];
  const invFull = inventoryResult.data || [];
  const lowStockData = lowStockResult.data || [];
  const profitability = profitResult.data;
  const pvData = pvResult.data || [];

  const totalPaidReceipts = receipts.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const salesMonthLocal = monthInvoices.reduce((s: number, inv: any) => s + Number(inv.total), 0);

  let inventoryValue = 0;
  let totalStock = 0;
  for (const i of invFull as any[]) {
    const stock = Number(i.stock || 0);
    totalStock += stock;
    const cost = Number(i.products?.cost || 0);
    const applyItbis = i.products?.apply_itbis !== false;
    inventoryValue += stock * cost * (applyItbis ? 1.35 : 1.0);
  }

  const lowStock = lowStockData.filter((i: any) => i.stock_status === "BAJO").length;
  const outOfStock = lowStockData.filter((i: any) => i.stock_status === "AGOTADO").length;
  const pvMonth = pvData.reduce((s: number, ii: any) => s + Number(ii.pv || 0), 0);
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
