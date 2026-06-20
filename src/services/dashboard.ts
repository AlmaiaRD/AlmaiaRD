import { supabase } from "@/lib/supabase";

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

  const { data: inventory, error: invError } = await supabase
    .from("vw_inventory_value")
    .select("*");
  if (invError) throw invError;

  const { data: profitability, error: profError } = await supabase
    .from("vw_profitability")
    .select("*")
    .single();
  if (profError) throw profError;

  const { data: pv, error: pvError } = await supabase
    .from("vw_pv_summary")
    .select("*")
    .single();
  if (pvError) throw pvError;

  const totalPending = ar.reduce((sum: number, r: any) => sum + Number(r.total_pending), 0);
  const totalPaid = ar.reduce((sum: number, r: any) => sum + Number(r.total_paid), 0);
  const inventoryValue = inventory.reduce((sum: number, i: any) => sum + Number(i.total_value), 0);
  const totalStock = inventory.reduce((sum: number, i: any) => sum + Number(i.stock), 0);
  const lowStock = inventory.filter((i: any) => i.stock_status === "BAJO").length;
  const outOfStock = inventory.filter((i: any) => i.stock_status === "AGOTADO").length;

  return {
    salesToday: sales?.sales_today ?? 0,
    salesMonth: sales?.sales_month ?? 0,
    salesYear: sales?.sales_year ?? 0,
    totalSales: sales?.total_sales ?? 0,
    totalPending,
    totalPaid,
    inventoryValue,
    totalStock,
    lowStock,
    outOfStock,
    grossProfit: profitability?.gross_profit ?? 0,
    realProfit: profitability?.real_profit ?? 0,
    pvMonth: pv?.pv_month ?? 0,
    pvYear: pv?.pv_year ?? 0,
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
