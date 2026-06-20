"use client";

import { useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/utils";
import {
  getVentasReport, getCobrosReport, getInventarioReport,
  getClientesReport, getPvReport, getGastosReport,
} from "@/services/reports";
import { FileText, BarChart3, Download, TrendingUp, DollarSign, ShoppingCart, Users, Eye, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface ReportConfig {
  id: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  fetchData: (from?: string, to?: string) => Promise<{ columns: { header: string; key: string }[]; rows: Record<string, any>[]; filename: string }>;
}

const REPORTS: ReportConfig[] = [
  {
    id: "ventas", icon: TrendingUp, label: "Ventas", desc: "Facturación por período", color: "bg-blue-50 text-blue-600",
    fetchData: async (from, to) => {
      const data = await getVentasReport(from, to);
      return {
        columns: [
          { header: "No. Factura", key: "factura" },
          { header: "Fecha", key: "fecha" },
          { header: "Cliente", key: "cliente" },
          { header: "Total", key: "total" },
          { header: "Estado", key: "estado" },
        ],
        rows: data.map((r) => ({ ...r, total: formatCurrency(r.total) })),
        filename: "reporte-ventas",
      };
    },
  },
  {
    id: "cobros", icon: DollarSign, label: "Cobros", desc: "Recibos y métodos de pago", color: "bg-green-50 text-green-600",
    fetchData: async (from, to) => {
      const data = await getCobrosReport(from, to);
      return {
        columns: [
          { header: "No. Recibo", key: "recibo" },
          { header: "Fecha", key: "fecha" },
          { header: "Factura", key: "factura" },
          { header: "Cliente", key: "cliente" },
          { header: "Monto", key: "monto" },
          { header: "Método", key: "metodo" },
        ],
        rows: data.map((r) => ({ ...r, monto: formatCurrency(r.monto) })),
        filename: "reporte-cobros",
      };
    },
  },
  {
    id: "inventario", icon: ShoppingCart, label: "Inventario", desc: "Existencias y alertas de stock", color: "bg-amber-50 text-amber-600",
    fetchData: async () => {
      const data = await getInventarioReport();
      return {
        columns: [
          { header: "Producto", key: "producto" },
          { header: "Submarca", key: "submarca" },
          { header: "Stock", key: "stock" },
          { header: "Mínimo", key: "minimo" },
          { header: "Estado", key: "estado" },
        ],
        rows: data,
        filename: "reporte-inventario",
      };
    },
  },
  {
    id: "clientes", icon: Users, label: "Clientes", desc: "Compras y saldos pendientes", color: "bg-purple-50 text-purple-600",
    fetchData: async () => {
      const data = await getClientesReport();
      return {
        columns: [
          { header: "Cliente", key: "cliente" },
          { header: "Total Comprado", key: "total_comprado" },
          { header: "Total Pagado", key: "total_pagado" },
          { header: "Saldo Pendiente", key: "saldo_pendiente" },
          { header: "Estado", key: "estado" },
        ],
        rows: data.map((r) => ({
          ...r,
          total_comprado: formatCurrency(r.total_comprado),
          total_pagado: formatCurrency(r.total_pagado),
          saldo_pendiente: formatCurrency(r.saldo_pendiente),
        })),
        filename: "reporte-clientes",
      };
    },
  },
  {
    id: "pv", icon: BarChart3, label: "PV", desc: "Puntos de volumen por cliente", color: "bg-rose-50 text-rose-600",
    fetchData: async (from, to) => {
      const data = await getPvReport(from, to);
      return {
        columns: [
          { header: "Cliente", key: "cliente" },
          { header: "PV Generado", key: "pv_generado" },
          { header: "Comisión", key: "comision" },
        ],
        rows: data.map((r) => ({ ...r, comision: formatCurrency(r.comision) })),
        filename: "reporte-pv",
      };
    },
  },
  {
    id: "gastos", icon: FileText, label: "Gastos", desc: "Gastos operativos por categoría", color: "bg-orange-50 text-orange-600",
    fetchData: async (from, to) => {
      const data = await getGastosReport(from, to);
      return {
        columns: [
          { header: "Fecha", key: "fecha" },
          { header: "Descripción", key: "descripcion" },
          { header: "Categoría", key: "categoria" },
          { header: "Subcategoría", key: "subcategoria" },
          { header: "Monto", key: "monto" },
        ],
        rows: data.map((r) => ({ ...r, monto: formatCurrency(r.monto) })),
        filename: "reporte-gastos",
      };
    },
  },
];

export default function ReportesPage() {
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);

  const activeReport = REPORTS.find((r) => r.id === selectedReport);

  async function handlePreview() {
    if (!activeReport) return;
    setGenerating(true);
    try {
      const data = await activeReport.fetchData(dateFrom || undefined, dateTo || undefined);
      setPreviewData({
        columns: data.columns.map((c) => c.header),
        rows: data.rows,
      });
    } catch {
      toast.error("Error al generar vista previa");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!activeReport) return;
    setGenerating(true);
    try {
      const data = await activeReport.fetchData(dateFrom || undefined, dateTo || undefined);
      exportToExcel(data.rows, data.columns, data.filename);
      toast.success(`${activeReport.label} descargado`);
    } catch {
      toast.error("Error al generar reporte");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver al Dashboard
        </button>
        <h1 className="text-xl font-bold text-[#5C3E35]">Reportes</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Informes comerciales y financieros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => { setSelectedReport(r.id); setPreviewData(null); }}
            className={`bg-white rounded-2xl p-5 shadow-sm border text-left transition-all hover:shadow-md ${
              selectedReport === r.id ? "border-[#B8837E] ring-2 ring-[#B8837E]/20" : "border-[#E8E0D8]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${r.color}`}>
              <r.icon size={20} />
            </div>
            <h3 className="text-sm font-semibold text-[#5C3E35]">{r.label}</h3>
            <p className="text-xs text-[#9C8A82] mt-1">{r.desc}</p>
          </button>
        ))}
      </div>

      {activeReport && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
          <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">{activeReport.label}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreviewData(null); }}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreviewData(null); }}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
          </div>
          <div className="flex gap-3 mb-4">
            <button onClick={handlePreview} disabled={generating}
              className="flex items-center gap-2 border border-[#B8837E] text-[#B8837E] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#B8837E]/5 transition-all disabled:opacity-50">
              <Eye size={16} /> {generating ? "Cargando..." : "Vista Previa"}
            </button>
            <button onClick={handleDownload} disabled={generating}
              className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">
              <Download size={16} /> Descargar Excel
            </button>
          </div>

          {previewData && (
            <div className="overflow-x-auto border-t border-[#F0EBE3] pt-4">
              {previewData.rows.length === 0 ? (
                <p className="text-center text-sm text-[#9C8A82] py-8">Sin datos para el período seleccionado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {previewData.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-[#9C8A82] uppercase border-b border-[#F0EBE3]">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, i) => (
                      <tr key={i} className="border-b border-[#F0EBE3] last:border-0">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-[#5C3E35]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}