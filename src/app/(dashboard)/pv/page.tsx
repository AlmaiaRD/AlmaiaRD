"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { normalize } from "@/lib/search";
import { getPvSummary, getPvByClient, getPvByMonth, getPvBySubbrand } from "@/services/pv";
import { BarChart2, TrendingUp, Target, Award, Search, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useRouter } from "next/navigation";

const PIE_COLORS = ["#B8837E", "#86C7A3", "#E8C87A", "#9C8A82", "#D4A0A0", "#A3C7D4"];

export default function PvPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pvMonth, setPvMonth] = useState(0);
  const [pvYear, setPvYear] = useState(0);
  const [byClient, setByClient] = useState<{ name: string; pv: number; invoices: number }[]>([]);
  const [byMonth, setByMonth] = useState<{ mes: string; pv: number }[]>([]);
  const [bySubbrand, setBySubbrand] = useState<{ name: string; pv: number }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [summary, client, month, subbrand] = await Promise.all([
          getPvSummary(),
          getPvByClient(),
          getPvByMonth(),
          getPvBySubbrand(),
        ]);
        setPvMonth(Number(summary.pv_month));
        setPvYear(Number(summary.pv_year));
        setByClient(client);
        setByMonth(month);
        setBySubbrand(subbrand);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = byClient.filter((c) =>
    normalize(c.name).includes(normalize(searchQuery))
  );

  const META_PV = 2000;
  const porcentajeMeta = Math.min(100, Math.round((pvMonth / META_PV) * 100));

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver al Dashboard
        </button>
        <h1 className="text-xl font-bold text-[#5C3E35]">PV — Puntos de Volumen</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Control de puntos de volumen y comisiones generadas</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <p className="text-xs text-[#9C8A82] mb-1">PV Este Mes</p>
              <p className="text-2xl font-bold text-[#5C3E35]">{pvMonth.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <p className="text-xs text-[#9C8A82] mb-1">PV Año</p>
              <p className="text-2xl font-bold text-[#5C3E35]">{pvYear.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#9C8A82]">Meta Mensual</p>
                <span className="text-xs font-medium text-[#86C7A3]">{porcentajeMeta}%</span>
              </div>
              <div className="w-full bg-[#F0EBE3] rounded-full h-2.5 mb-2">
                <div className="bg-[#86C7A3] h-2.5 rounded-full transition-all" style={{ width: `${porcentajeMeta}%` }} />
              </div>
              <p className="text-xs text-[#9C8A82]">{pvMonth.toLocaleString()} / {META_PV.toLocaleString()} PV</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">PV por Mes</h3>
              <div className="h-64">
                {byMonth.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[#9C8A82]">Sin datos</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                      <XAxis dataKey="mes" tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9C8A82", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E0D8" }} />
                      <Bar dataKey="pv" fill="#B8837E" radius={[6, 6, 0, 0]} name="PV" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">PV por Submarca</h3>
              <div className="h-64">
                {bySubbrand.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[#9C8A82]">Sin datos</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bySubbrand} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="pv">
                        {bySubbrand.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E0D8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {bySubbrand.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-[#9C8A82]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente..."
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Facturas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">PV</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">Comisión (20%)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-[#9C8A82] text-sm">
                      {searchQuery ? "Sin resultados" : "Sin datos de PV este mes"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr key={i} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md">
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] font-medium">{c.name}</td>
                      <td className="px-4 py-3.5 text-sm text-[#9C8A82] text-center">{c.invoices}</td>
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{c.pv.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-sm text-[#86C7A3] text-right font-medium">RD$ {(c.pv * 20).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}