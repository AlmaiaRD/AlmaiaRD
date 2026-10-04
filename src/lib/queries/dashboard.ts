"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getInvoices } from "@/services/invoices";
import { getReceipts } from "@/services/receipts";
import { getDashboardStats } from "@/services/dashboard";
import type { Invoice, Receipt } from "@/types/database";

export interface DashboardStats {
  salesToday: number;
  salesMonth: number;
  salesYear: number;
  totalSales: number;
  totalPending: number;
  totalPaid: number;
  inventoryValue: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
  grossProfit: number;
  realProfit: number;
  pvMonth: number;
  pvYear: number;
}

export interface LowStockItem {
  name: string;
  stock: number;
  status: string;
}

export interface MonthDataItem {
  mes: string;
  ventas: number;
  cobros: number;
}

export interface DailySalesItem {
  dia: string;
  ventas: number;
}

export interface PaymentMethodItem {
  name: string;
  value: number;
}

export interface DashboardData {
  stats: DashboardStats | null;
  lowStock: LowStockItem[];
  recentInvoices: (Invoice & { clients?: { full_name?: string | null } })[];
  recentReceipts: (Receipt & {
    clients?: { full_name?: string | null };
    invoices?: { clients?: { full_name?: string | null } };
  })[];
  monthData: MonthDataItem[];
  dailySales: DailySalesItem[];
  paymentMethodData: PaymentMethodItem[];
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
};

const EMPTY: DashboardData = {
  stats: null,
  lowStock: [],
  recentInvoices: [],
  recentReceipts: [],
  monthData: [],
  dailySales: [],
  paymentMethodData: [],
};

/**
 * Todo lo que pinta el panel en una sola ida a la base de datos.
 *
 * Antes eran siete useState y un useEffect que iba rellenándolos uno a uno
 * mientras la pantalla ya se veía a medias. Aqui se piden las siete cosas en
 * paralelo y se devuelven ya transformadas: si algo falla, se devuelve EMPTY
 * y el panel sale vacio, que es lo mismo que se veía antes.
 *
 * La clave lleva el mes porque el panel cambia de contenido al cambiar el
 * mes; asi el cache no mezcla datos de meses distintos.
 *
 * `staleTime: 0` y `enabled` a proposito, y es lo unico que se separa del
 * resto de la app: el panel es un resumen de dinero. Si alguien factura algo
 * y vuelve aqui un minuto despues tiene que ver la cifra nueva, no la
 * anterior, y tampoco se pregunta nada hasta que hay alguien con sesion
 * iniciada. Aun asi se gana: React Query no repite la peticion si ya esta en
 * vuelo, no pinta la pantalla a medias y no vuelve a preguntar al cambiar de
 * ventana.
 */
export function useDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", new Date().toISOString().substring(0, 7)],
    queryFn: fetchDashboardData,
    enabled,
    staleTime: 0,
  });
}

async function fetchDashboardData(): Promise<DashboardData> {
  const today = new Date();
  const monthStart = `${today.toISOString().split("T")[0].substring(0, 7)}-01`;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const cutoff = sixMonthsAgo.toISOString().split("T")[0];

  const [stats, invoices, receipts, monthRes, dailyRes, pmRes, lowStockRes] = await Promise.all([
    getDashboardStats(),
    getInvoices(),
    getReceipts(),
    supabase
      .from("invoices")
      .select("created_at, total, amount_paid")
      .gte("created_at", cutoff)
      .not("status", "eq", "CANCELLED"),
    supabase
      .from("invoices")
      .select("created_at, total")
      .gte("created_at", monthStart)
      .not("status", "eq", "CANCELLED"),
    supabase.from("receipts").select("payment_method, amount").gte("created_at", monthStart),
    supabase
      .from("vw_inventory_value")
      .select("product_name, stock, stock_status")
      .in("stock_status", ["BAJO", "AGOTADO"])
      .limit(5),
  ]);

  return {
    stats,
    recentInvoices: invoices.slice(0, 5),
    recentReceipts: receipts.slice(0, 5),
    monthData: buildMonthData(monthRes.data || []),
    dailySales: buildDailySales(dailyRes.data || [], today),
    paymentMethodData: buildPaymentMethods(pmRes.data || []),
    lowStock: (lowStockRes.data || []).map((i: { product_name?: string; stock?: number | null; stock_status?: string | null }) => ({
      name: i.product_name || "",
      stock: i.stock || 0,
      status: i.stock_status || "",
    })),
  };
}

type InvoiceRow = { created_at?: string; total?: number | null; amount_paid?: number | null };

/** Ultimos 6 meses, incluidos los que no tiveram ventas (para que el grafico no se corte). */
function buildMonthData(rows: InvoiceRow[]): MonthDataItem[] {
  const monthly: Record<string, { ventas: number; cobros: number }> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    monthly[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { ventas: 0, cobros: 0 };
  }
  for (const inv of rows) {
    const key = inv.created_at?.substring(0, 7);
    if (key && monthly[key]) {
      monthly[key].ventas += Number(inv.total);
      monthly[key].cobros += Number(inv.amount_paid || 0);
    }
  }
  return Object.entries(monthly)
    .slice(0, 6)
    .map(([key, val]) => ({ mes: MONTHS[parseInt(key.split("-")[1], 10) - 1] || key, ...val }));
}

/** Los ultimos 15 dias del mes en curso. */
function buildDailySales(rows: { created_at?: string; total?: number | null }[], today: Date): DailySalesItem[] {
  const daily: Record<string, number> = {};
  for (const inv of rows) {
    const day = inv.created_at?.substring(8, 10);
    if (day) daily[day] = (daily[day] || 0) + Number(inv.total);
  }
  const daysInMonth = today.getDate();
  const startDay = Math.max(1, daysInMonth - 14);
  const length = Math.min(15, daysInMonth);
  return Array.from({ length }, (_, i) => ({
    dia: `${startDay + i}`,
    ventas: daily[String(startDay + i).padStart(2, "0")] || 0,
  }));
}

/** Reparto por forma de pago, en porcentaje. */
function buildPaymentMethods(rows: { payment_method?: string; amount?: number | null }[]): PaymentMethodItem[] {
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const key = r.payment_method || "";
    totals[key] = (totals[key] || 0) + Number(r.amount);
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals).map(([key, val]) => ({
    name: PAYMENT_LABELS[key] || key,
    value: Math.round((val / sum) * 100),
  }));
}

export { EMPTY as EMPTY_DASHBOARD };
