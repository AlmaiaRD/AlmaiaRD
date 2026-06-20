import { supabase } from "@/lib/supabase";

export async function getPvSummary() {
  const { data, error } = await supabase
    .from("vw_pv_summary")
    .select("*")
    .single();
  if (error) throw error;
  return data as { pv_month: number; pv_year: number };
}

export async function getPvByClient() {
  const { data, error } = await supabase
    .from("invoices")
    .select("client_id, clients(full_name), pv_total, invoice_date, status")
    .not("status", "eq", "CANCELLED")
    .gte("invoice_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
    .order("invoice_date", { ascending: false });
  if (error) throw error;

  const byClient: Record<string, { name: string; pv: number; invoices: number }> = {};
  (data || []).forEach((inv: any) => {
    const id = inv.client_id;
    if (!byClient[id]) byClient[id] = { name: inv.clients?.full_name || "Sin cliente", pv: 0, invoices: 0 };
    byClient[id].pv += Number(inv.pv_total || 0);
    byClient[id].invoices += 1;
  });

  return Object.values(byClient).sort((a, b) => b.pv - a.pv);
}

export async function getPvByMonth() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const cutoff = sixMonthsAgo.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("invoices")
    .select("created_at, pv_total")
    .gte("created_at", cutoff)
    .not("status", "eq", "CANCELLED");
  if (error) throw error;

  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthly: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = 0;
  }
  (data || []).forEach((inv: any) => {
    const key = inv.created_at?.substring(0, 7);
    if (monthly[key] !== undefined) monthly[key] += Number(inv.pv_total || 0);
  });

  return Object.entries(monthly).map(([key, pv]) => ({
    mes: MONTHS[parseInt(key.split("-")[1]) - 1] || key,
    pv,
  }));
}

export async function getPvBySubbrand() {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("pv, products(subbrand_id, subbrands(name)), invoices!inner(status, invoice_date)")
    .not("invoices.status", "eq", "CANCELLED")
    .gte("invoices.invoice_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  if (error) throw error;

  const bySubbrand: Record<string, number> = {};
  (data || []).forEach((item: any) => {
    const name = item.products?.subbrands?.name || "Sin submarca";
    bySubbrand[name] = (bySubbrand[name] || 0) + Number(item.pv || 0);
  });

  return Object.entries(bySubbrand)
    .map(([name, pv]) => ({ name, pv }))
    .sort((a, b) => b.pv - a.pv);
}
