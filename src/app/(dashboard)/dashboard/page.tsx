"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageContainer from "@/components/layout/PageContainer";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/utils";
import { getInvoices } from "@/services/invoices";
import { getReceipts } from "@/services/receipts";
import { getDashboardStats } from "@/services/dashboard";
import { supabase } from "@/lib/supabase";
import {
  DollarSign,
  TrendingUp,
  PiggyBank,
  Package,
  BarChart3,
  Users,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  Award,
  FileText,
  ShoppingCart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const PIE_COLORS = ["#86C7A3", "#B8837E", "#E8C87A"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);

  const [stats, setStats] = useState<any>({});
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [monthData, setMonthData] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState("");
  const [goalMonth, setGoalMonth] = useState("");

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const savedMonth = localStorage.getItem("almaia_goal_month");
    const savedGoal = localStorage.getItem("almaia_monthly_goal");

    if (savedMonth !== currentMonth) {
      // New month — archive old goal if exists
      if (savedMonth && savedGoal && Number(savedGoal) > 0) {
        const history = JSON.parse(localStorage.getItem("almaia_goal_history") || "[]");
        history.push({ month: savedMonth, goal: Number(savedGoal), date: new Date().toISOString() });
        localStorage.setItem("almaia_goal_history", JSON.stringify(history));
      }
      // Reset for new month
      localStorage.setItem("almaia_goal_month", currentMonth);
      localStorage.setItem("almaia_monthly_goal", "0");
      setMonthlyGoal(0);
      setGoalInput("");
      setGoalMonth(currentMonth);
    } else if (savedGoal) {
      setMonthlyGoal(Number(savedGoal));
      setGoalInput(savedGoal);
      setGoalMonth(currentMonth);
    } else {
      setGoalInput("");
      setGoalMonth(currentMonth);
    }

    async function load() {
      try {
        const [s, inv, rec] = await Promise.all([
          getDashboardStats(),
          getInvoices(),
          getReceipts(),
        ]);
        setStats(s);

        setRecentInvoices(inv.slice(0, 5));
        setRecentReceipts(rec.slice(0, 5));

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const cutoff = sixMonthsAgo.toISOString().split("T")[0];

        const { data: monthRaw } = await supabase
          .from("invoices")
          .select("created_at, total, amount_paid")
          .gte("created_at", cutoff)
          .not("status", "eq", "CANCELLED");

        const monthly: Record<string, { ventas: number; cobros: number }> = {};
        for (let i = 0; i < 6; i++) {
          const d = new Date();
          d.setMonth(d.getMonth() - (5 - i));
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthly[key] = { ventas: 0, cobros: 0 };
        }
        (monthRaw || []).forEach((inv: any) => {
          const key = inv.created_at?.substring(0, 7);
          if (monthly[key]) {
            monthly[key].ventas += Number(inv.total);
            monthly[key].cobros += Number(inv.amount_paid || 0);
          }
        });
        const monthEntries = Object.entries(monthly).slice(0, 6);
        setMonthData(
          monthEntries.map(([key, val], i) => ({
            mes: MONTHS[parseInt(key.split("-")[1]) - 1] || key,
            ventas: (val as any).ventas,
            cobros: (val as any).cobros,
          }))
        );

        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString().split("T")[0];
        const { data: dailyRaw } = await supabase
          .from("invoices")
          .select("created_at, total")
          .gte("created_at", monthStart)
          .not("status", "eq", "CANCELLED");
        const daily: Record<string, number> = {};
        (dailyRaw || []).forEach((inv: any) => {
          const day = inv.created_at?.substring(8, 10);
          daily[day] = (daily[day] || 0) + Number(inv.total);
        });
        const daysInMonth = today.getDate();
        setDailySales(
          Array.from({ length: Math.min(15, daysInMonth) }, (_, i) => ({
            dia: `${daysInMonth - 14 + i}`,
            ventas: daily[String(daysInMonth - 14 + i).padStart(2, "0")] || 0,
          }))
        );

        const { data: pmRaw } = await supabase
          .from("receipts")
          .select("payment_method, amount")
          .gte("created_at", monthStart);
        const pm: Record<string, number> = {};
        (pmRaw || []).forEach((r: any) => {
          pm[r.payment_method] = (pm[r.payment_method] || 0) + Number(r.amount);
        });
        const totalPm = Object.values(pm).reduce((a, b) => a + b, 0) || 1;
        const labels: Record<string, string> = {
          CASH: "Efectivo",
          TRANSFER: "Transferencia",
          CARD: "Tarjeta",
        };
        setPaymentMethodData(
          Object.entries(pm).map(([key, val]) => ({
            name: labels[key] || key,
            value: Math.round((val / totalPm) * 100),
          }))
        );
        if (Object.keys(pm).length === 0) {
          setPaymentMethodData([
            { name: "Efectivo", value: 45 },
            { name: "Transferencia", value: 30 },
            { name: "Tarjeta", value: 25 },
          ]);
        }

        const { data: invVal } = await supabase
          .from("vw_inventory_value")
          .select("product_name, stock, stock_status")
          .in("stock_status", ["BAJO", "AGOTADO"])
          .limit(5);
        setLowStock((invVal || []).map((i: any) => ({
          name: i.product_name,
          stock: i.stock,
          status: i.stock_status,
        })));
      } catch {
        // fallback to defaults
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [user]);

  if (!user) return null;

  // KPI Metas calculations
  const vendido = Number(stats.salesMonth) || 0;
  const cobrado = Number(stats.totalPaid) || 0;
  const metaActual = monthlyGoal || 1;
  const restanteKpi = Math.max(monthlyGoal - vendido, 0);
  const vendidoPct = monthlyGoal > 0 ? Math.min((vendido / metaActual) * 100, 100) : 0;
  const cobradoPct = monthlyGoal > 0 ? Math.min((cobrado / metaActual) * 100, 100) : 0;
  const barCobrado = cobradoPct;
  const barVendido = vendidoPct > cobradoPct ? vendidoPct - cobradoPct : 0;
  const barRestante = monthlyGoal > 0 ? Math.max(100 - vendidoPct, 0) : 100;

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#5C3E35]">
          Buenas tardes, {user.name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="text-sm text-[#9C8A82] mt-1">Resumen de tu negocio</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard title="Ventas del Día" value={formatCurrency(Number(stats.salesToday))} icon={DollarSign} color="primary" />
            <KpiCard title="Ventas del Mes" value={formatCurrency(Number(stats.salesMonth))} icon={TrendingUp} color="primary" />
            <KpiCard title="Cobros Recibidos" value={formatCurrency(Number(stats.totalPaid))} icon={PiggyBank} color="green" />
            <KpiCard title="Ganancias" value={formatCurrency(Number(stats.grossProfit))} icon={BarChart3} color="primary" />
            <KpiCard title="Valor Inventario" value={formatCurrency(Number(stats.inventoryValue))} icon={Package} color="amber" />
            <KpiCard title="Stock Disponible" value={String(Number(stats.totalStock))} icon={Package} color="amber" />
            <KpiCard title="Cuentas por Cobrar" value={formatCurrency(Number(stats.totalPending))} icon={Users} color="rose" />
            <KpiCard title="PV del Mes" value={String(Number(stats.pvMonth))} icon={BarChart3} color="green" />
          </div>

          {/* KPI Metas */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#5C3E35]">Meta Mensual</h3>
              <span className="text-xs text-[#9C8A82]">{goalMonth}</span>
            </div>

            <div className="bg-[#FCFAF7] border border-dashed border-[#E8E0D8] rounded-xl p-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <label className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Meta</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="0"
                  className="text-lg font-extrabold text-[#5C3E35] border-none bg-transparent w-36 text-right outline-none placeholder:text-[#E8E0D8]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = Number(goalInput) || 0;
                    setMonthlyGoal(val);
                    setGoalInput(String(val));
                    localStorage.setItem("almaia_monthly_goal", String(val));
                  }}
                  className="text-xs bg-[#B8837E] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#9A6B66] active:scale-95 transition-all cursor-pointer"
                >
                  Fijar Meta
                </button>
              </div>
            </div>

            <div className="flex mb-1.5 text-xs font-semibold text-[#5C3E35]">
              <div style={{ flex: barCobrado || 1 }} className="text-left">Cobrado</div>
              <div style={{ flex: barVendido || 1 }} className="text-center">Vendido</div>
              <div style={{ flex: barRestante || 1 }} className="text-right">Restante</div>
            </div>

            <div className="flex h-9 rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)" }}>
              <div
                className="flex items-center justify-center text-xs font-bold text-white transition-all duration-500"
                style={{ width: `${barCobrado}%`, backgroundColor: "#86C7A3" }}
              >
                {cobrado > 0 ? formatCurrency(cobrado) : ""}
              </div>
              <div
                className="flex items-center justify-center text-xs font-bold text-white transition-all duration-500"
                style={{ width: `${barVendido}%`, backgroundColor: "#B8837E" }}
              >
                {vendido > cobrado ? formatCurrency(vendido) : ""}
              </div>
              <div
                className="flex items-center justify-center text-xs font-bold text-[#9C8A82] transition-all duration-500"
                style={{ width: `${barRestante}%`, backgroundColor: "#E8E0D8" }}
              >
                {restanteKpi > 0 && monthlyGoal > 0 ? formatCurrency(restanteKpi) : ""}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="flex-1 bg-[#FCFAF7] rounded-xl p-3 text-center border border-[#E8E0D8]">
                <div className="text-[10px] font-semibold text-[#9C8A82] uppercase tracking-wider">Cobrado</div>
                <div className="text-base font-extrabold text-[#86C7A3] mt-1">{formatCurrency(cobrado)}</div>
                <div className="text-xs text-[#9C8A82] mt-0.5">{monthlyGoal > 0 ? cobradoPct.toFixed(1) + "%" : "—"}</div>
              </div>
              <div className="flex-1 bg-[#FCFAF7] rounded-xl p-3 text-center border border-[#E8E0D8]">
                <div className="text-[10px] font-semibold text-[#9C8A82] uppercase tracking-wider">Vendido</div>
                <div className="text-base font-extrabold text-[#B8837E] mt-1">{formatCurrency(vendido)}</div>
                <div className="text-xs text-[#9C8A82] mt-0.5">{monthlyGoal > 0 ? vendidoPct.toFixed(1) + "%" : "—"}</div>
              </div>
              <div className="flex-1 bg-[#FCFAF7] rounded-xl p-3 text-center border border-[#E8E0D8]">
                <div className="text-[10px] font-semibold text-[#9C8A82] uppercase tracking-wider">Restante</div>
                <div className="text-base font-extrabold text-[#5C3E35] mt-1">{formatCurrency(restanteKpi)}</div>
                <div className="text-xs text-[#9C8A82] mt-0.5">{monthlyGoal > 0 ? (Math.max(100 - vendidoPct, 0)).toFixed(1) + "%" : "—"}</div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Módulos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { href: "/bonificaciones", label: "Bonificaciones", icon: Award, color: "bg-purple-50 text-purple-600" },
                { href: "/pv", label: "Puntos de Volumen", icon: BarChart3, color: "bg-blue-50 text-blue-600" },
                { href: "/reportes", label: "Reportes", icon: FileText, color: "bg-amber-50 text-amber-600" },
                { href: "/documentos", label: "Documentos", icon: ShoppingCart, color: "bg-green-50 text-green-600" },
              ].map((mod) => (
                <button
                  key={mod.href}
                  onClick={() => router.push(mod.href)}
                  className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl shadow-sm border border-[#E8E0D8] hover:shadow-md hover:border-[#B8837E]/30 transition-all"
                >
                  <div className={`p-3 rounded-xl ${mod.color}`}>
                    <mod.icon size={22} />
                  </div>
                  <span className="text-sm font-medium text-[#5C3E35]">{mod.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Comparativa Mensual</h3>
                <span className="text-xs text-[#9C8A82]">Últimos 6 meses</span>
              </div>
              <div className="h-64">
                {monthData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[#9C8A82]">Sin datos</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                      <XAxis dataKey="mes" tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #E8E0D8", backgroundColor: "#fff" }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                      />
                      <Bar dataKey="ventas" fill="#B8837E" radius={[6, 6, 0, 0]} name="Ventas" />
                      <Bar dataKey="cobros" fill="#86C7A3" radius={[6, 6, 0, 0]} name="Cobros" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Métodos de Pago</h3>
                <span className="text-xs text-[#9C8A82]">Este mes</span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentMethodData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E8E0D8" }}
                      formatter={(value: any) => `${value}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {paymentMethodData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-[#9C8A82]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Ventas Diarias</h3>
                <span className="text-xs text-[#9C8A82]">Últimos 15 días</span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                    <XAxis dataKey="dia" tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E8E0D8" }}
                      formatter={(value: any) => formatCurrency(Number(value))}
                    />
                    <Line type="monotone" dataKey="ventas" stroke="#B8837E" strokeWidth={2} dot={{ fill: "#B8837E", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-[#E8C87A]" />
                <h3 className="text-sm font-semibold text-[#5C3E35]">Alertas de Stock</h3>
              </div>
              {lowStock.length === 0 ? (
                <div className="text-center py-8 text-[#9C8A82] text-sm">Sin alertas pendientes</div>
              ) : (
                <div className="space-y-3">
                  {lowStock.map((p) => (
                    <div key={p.name} className="flex items-center justify-between p-3 bg-[#FFFBEB] rounded-xl border border-[#E8C87A]/30">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{p.name}</p>
                        <p className="text-xs text-[#9C8A82]">Stock: {p.stock}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        p.status === "AGOTADO"
                          ? "text-red-600 bg-red-50"
                          : "text-[#E8C87A] bg-[#E8C87A]/10"
                      }`}>
                        {p.status === "AGOTADO" ? "Agotado" : "Bajo"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Facturas Recientes</h3>
                <button onClick={() => router.push("/facturacion")} className="text-xs text-[#B8837E] hover:underline flex items-center gap-1">
                  Ver todas <ArrowUpRight size={12} />
                </button>
              </div>
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8 text-[#9C8A82] text-sm">Sin facturas recientes</div>
              ) : (
                <div className="divide-y divide-[#F0EBE3]">
                  {recentInvoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{inv.invoice_number}</p>
                        <p className="text-xs text-[#9C8A82]">{inv.clients?.full_name || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(Number(inv.total))}</p>
                        <span className={`text-xs font-medium ${
                          inv.status === "PAID" ? "text-[#86C7A3]" : inv.status === "PENDING" ? "text-[#E8C87A]" : "text-[#9C8A82]"
                        }`}>
                          {inv.status === "PAID" ? "Pagada" : inv.status === "PENDING" ? "Pendiente" : inv.status === "PARTIAL" ? "Parcial" : inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Recibos Recientes</h3>
                <button onClick={() => router.push("/recibos")} className="text-xs text-[#86C7A3] hover:underline flex items-center gap-1">
                  Ver todos <ArrowUpRight size={12} />
                </button>
              </div>
              {recentReceipts.length === 0 ? (
                <div className="text-center py-8 text-[#9C8A82] text-sm">Sin recibos recientes</div>
              ) : (
                <div className="divide-y divide-[#F0EBE3]">
                  {recentReceipts.map((rec: any) => (
                    <div key={rec.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{rec.receipt_number}</p>
                        <p className="text-xs text-[#9C8A82]">{rec.clients?.full_name || rec.invoices?.clients?.full_name || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#86C7A3]">{formatCurrency(Number(rec.amount))}</p>
                        <span className="text-xs text-[#9C8A82]">
                          {rec.payment_method === "CASH" ? "Efectivo" : rec.payment_method === "TRANSFER" ? "Transferencia" : "Tarjeta"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
