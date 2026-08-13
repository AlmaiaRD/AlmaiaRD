"use client";

import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getInventoryMovements } from "@/services/inventory";
import { formatDate } from "@/lib/utils";
import { Package, EyeOff, Download, FileText, BarChart3, Loader, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

const movementLabel: Record<string, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  CANCELLATION: "Cancelación",
};

const movementColor: Record<string, string> = {
  PURCHASE: "text-green-600",
  SALE: "text-red-500",
  ADJUSTMENT: "text-yellow-600",
  RETURN: "text-blue-500",
  CANCELLATION: "text-gray-500",
};

interface RotationTabProps {
  rotationData: any[];
  rotationLoading: boolean;
  rotationFilterSubbrand: string;
  rotationFilterDays: string;
  rotationFilterStatus: string;
  rotationExportOpen: boolean;
  rotationDetailProductId: string | null;
  rotationDetailMovements: any[];
  rotationDetailLoading: boolean;
  rotationDetailItem: any;
  rotationAiAnalysis: string | null;
  rotationAiLoading: boolean;
  hiddenRotationIds: string[];
  showHiddenRotation: boolean;
  setRotationFilterSubbrand: (v: string) => void;
  setRotationFilterDays: (v: string) => void;
  setRotationFilterStatus: (v: string) => void;
  setRotationExportOpen: (v: boolean) => void;
  setRotationDetailProductId: (v: string | null) => void;
  setRotationDetailMovements: (v: any[]) => void;
  setRotationDetailLoading: (v: boolean) => void;
  setRotationDetailItem: (v: any) => void;
  setRotationAiAnalysis: (v: string | null) => void;
  setRotationAiLoading: (v: boolean) => void;
  toggleHideRotationProduct: (productId: string) => void;
}

export default function RotationTab({
  rotationData,
  rotationLoading,
  rotationFilterSubbrand,
  rotationFilterDays,
  rotationFilterStatus,
  rotationExportOpen,
  rotationDetailProductId,
  rotationDetailMovements,
  rotationDetailLoading,
  rotationDetailItem,
  rotationAiAnalysis,
  rotationAiLoading,
  hiddenRotationIds,
  showHiddenRotation,
  setRotationFilterSubbrand,
  setRotationFilterDays,
  setRotationFilterStatus,
  setRotationExportOpen,
  setRotationDetailProductId,
  setRotationDetailMovements,
  setRotationDetailLoading,
  setRotationDetailItem,
  setRotationAiAnalysis,
  setRotationAiLoading,
  toggleHideRotationProduct,
}: RotationTabProps) {
  return (
    <>
      <div className="space-y-6">
        {rotationLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
        ) : rotationData.length === 0 ? (
          <div className="text-center py-16 text-[#9C8A82]">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay datos de rotación</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">Total Productos</p>
                <p className="text-xl font-bold text-[#5C3E35]">{rotationData.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">Rotación Alta (&lt; 15d)</p>
                <p className="text-xl font-bold text-[#86C7A3]">
                  {rotationData.filter((d: any) => d.diasEnInventario < 15 && d.diasEnInventario < 999).length}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">Rotación Media (15-60d)</p>
                <p className="text-xl font-bold text-[#E8C87A]">
                  {rotationData.filter((d: any) => d.diasEnInventario >= 15 && d.diasEnInventario <= 60).length}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">{'Rotación Baja (> 60d)'}</p>
                <p className="text-xl font-bold text-[#D4A0A0]">
                  {rotationData.filter((d: any) => d.diasEnInventario > 60 && d.diasEnInventario < 999).length}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">Próximos a agotarse</p>
                <p className="text-xl font-bold text-red-500">
                  {rotationData.filter((d: any) => {
                    if (d.sold <= 0 || d.stock <= 0) return false;
                    return d.velocidadDias > 0 && Math.round(d.velocidadDias * d.stock) < 30;
                  }).length}
                </p>
              </div>
            </div>

            {/* Capital Inmovilizado Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 30 días'}</p>
                <p className="text-lg font-bold text-[#E8C87A]">
                  {rotationData
                    .filter((d: any) => d.diasEnInventario > 30 && d.diasEnInventario < 999)
                    .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                    .toLocaleString()} RD$
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 60 días'}</p>
                <p className="text-lg font-bold text-[#D4A0A0]">
                  {rotationData
                    .filter((d: any) => d.diasEnInventario > 60 && d.diasEnInventario < 999)
                    .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                    .toLocaleString()} RD$
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 90 días'}</p>
                <p className="text-lg font-bold text-red-600">
                  {rotationData
                    .filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999)
                    .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                    .toLocaleString()} RD$
                </p>
              </div>
            </div>

            {/* Recommendations Card */}
            {(() => {
              const staleProducts = rotationData.filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999);
              const nearStockout = rotationData.filter((d: any) => {
                if (d.sold <= 0 || d.stock <= 0 || !d.velocidadDias) return false;
                return Math.round(d.velocidadDias * d.stock) < 30;
              });
              if (staleProducts.length === 0 && nearStockout.length === 0) return null;
              return (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} className="text-[#E8C87A]" />
                    <h3 className="text-sm font-bold text-[#5C3E35]">Recomendaciones Automáticas</h3>
                  </div>
                  <div className="space-y-2">
                    {staleProducts.map((d: any) => (
                      <div key={d.product_id} className="flex items-center justify-between bg-[#FAF6F0] rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <TrendingDown size={16} className="text-[#D4A0A0]" />
                          <span className="text-sm text-[#5C3E35]">{d.name}</span>
                          <span className="text-xs text-[#9C8A82]">{d.code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="danger">{d.diasEnInventario} días sin vender</Badge>
                          <span className="text-xs text-[#E8C87A] font-medium">Sugerir oferta / liquidar</span>
                        </div>
                      </div>
                    ))}
                    {nearStockout.map((d: any) => (
                      <div key={d.product_id} className="flex items-center justify-between bg-[#FAF6F0] rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <TrendingUp size={16} className="text-[#86C7A3]" />
                          <span className="text-sm text-[#5C3E35]">{d.name}</span>
                          <span className="text-xs text-[#9C8A82]">{d.code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="danger">Stock bajo</Badge>
                          <span className="text-xs text-[#86C7A3] font-medium">Reponer inventario pronto</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* AI Analysis Button & Result */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#B8837E]" />
                  <h3 className="text-sm font-bold text-[#5C3E35]">Análisis de Rotación con IA</h3>
                </div>
                <button
                  onClick={async () => {
                    setRotationAiLoading(true);
                    setRotationAiAnalysis(null);
                    try {
                      const res = await fetch("/api/inventory-analysis", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rotationData }),
                      });
                      const data = await res.json();
                      setRotationAiAnalysis(data.analysis || "Sin respuesta");
                    } catch {
                      toast.error("Error al analizar con IA");
                    } finally {
                      setRotationAiLoading(false);
                    }
                  }}
                  disabled={rotationAiLoading}
                  className="flex items-center gap-2 h-9 px-4 bg-[#B8837E] text-white rounded-xl text-xs font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50"
                >
                  {rotationAiLoading ? <Loader size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                  {rotationAiLoading ? "Analizando..." : "Analizar con IA"}
                </button>
              </div>
              {rotationAiAnalysis && (
                <div className="bg-[#FAF6F0] rounded-xl p-4 text-sm text-[#5C3E35] whitespace-pre-line leading-relaxed">
                  {rotationAiAnalysis}
                </div>
              )}
              {!rotationAiAnalysis && !rotationAiLoading && (
                <p className="text-xs text-[#9C8A82]">Haz clic en &quot;Analizar con IA&quot; para obtener recomendaciones inteligentes sobre la rotación de inventario.</p>
              )}
            </div>

            {/* Filters & Export */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={rotationFilterSubbrand}
                onChange={(e) => setRotationFilterSubbrand(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              >
                <option value="">Todas las submarcas</option>
                {[...new Set(rotationData.map((d: any) => d.subbrand).filter(Boolean))].map((s) => (
                  <option key={s as string} value={s as string}>{s as string}</option>
                ))}
              </select>
              <select
                value={rotationFilterDays}
                onChange={(e) => setRotationFilterDays(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              >
                <option value="">Todos los días</option>
                <option value="0-15">Rotación alta (0-15 días)</option>
                <option value="15-60">Rotación media (15-60 días)</option>
                <option value="60-999">Rotación baja (60+ días)</option>
                <option value="90-999">Crítico (90+ días)</option>
              </select>
              <select
                value={rotationFilterStatus}
                onChange={(e) => setRotationFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              >
                <option value="">Estado</option>
                <option value="success">Rotación alta</option>
                <option value="warning">Rotación media</option>
                <option value="danger">Rotación baja / Sin mov.</option>
              </select>
              {(rotationFilterSubbrand || rotationFilterDays || rotationFilterStatus) && (
                <button
                  onClick={() => { setRotationFilterSubbrand(""); setRotationFilterDays(""); setRotationFilterStatus(""); }}
                  className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto relative">
                <button
                  onClick={() => setRotationExportOpen(!rotationExportOpen)}
                  className="flex items-center gap-2 h-10 px-4 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                >
                  <Download size={16} /> Exportar
                </button>
                {rotationExportOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRotationExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-1 z-20">
                      <button
                        onClick={() => {
                          setRotationExportOpen(false);
                          const doc = new jsPDF({ unit: "mm", format: "letter" });
                          const pageW = 216;
                          let y = 20;
                          const margin = 15;
                          doc.setFontSize(16);
                          doc.setFont("helvetica", "bold");
                          doc.text("Reporte de Rotación de Inventario", margin, y);
                          y += 8;
                          doc.setFontSize(8);
                          doc.setFont("helvetica", "normal");
                          doc.text(`Generado: ${new Date().toLocaleDateString()}`, margin, y);
                          y += 8;
                          const cols = ["Producto", "Código", "Submarca", "Stock", "Días", "Velocidad", "Proy.Agot.", "Estado", "Capital"];
                          const widths = [40, 18, 22, 12, 12, 18, 18, 22, 22];
                          const startX = margin;
                          doc.setFontSize(7);
                          doc.setFont("helvetica", "bold");
                          let cx = startX;
                          cols.forEach((c, i) => {
                            doc.text(c, cx + (i > 0 ? widths[i] / 2 : 0), y, i > 0 ? { align: "center" } : undefined);
                            cx += widths[i];
                          });
                          y += 5;
                          doc.setFont("helvetica", "normal");
                          rotationData.forEach((item: any) => {
                            if (y > 270) { doc.addPage(); y = 20; }
                            const proy = item.velocidadDias > 0 && item.stock > 0 ? Math.round(item.velocidadDias * item.stock) : null;
                            const el = item.diasEnInventario >= 999 ? "Sin mov." :
                              item.diasEnInventario <= 15 ? "Alta" :
                              item.diasEnInventario <= 60 ? "Media" : "Baja";
                            const cap = ((item.costoPromedio || 0) * (item.stock || 0)).toLocaleString();
                            const vals = [
                              item.name?.substring(0, 20) || "—",
                              item.code || "",
                              item.subbrand?.substring(0, 15) || "—",
                              String(item.stock || 0),
                              item.diasEnInventario >= 999 ? "—" : String(item.diasEnInventario),
                              item.velocidadDias > 0 ? `${item.velocidadDias}d/v` : "Sin vtas",
                              proy ? `${proy}d` : "—",
                              el,
                              `${cap} RD$`,
                            ];
                            cx = startX;
                            vals.forEach((v, i) => {
                              doc.text(v, cx + (i > 0 ? widths[i] / 2 : 0), y, i > 0 ? { align: "center" } : undefined);
                              cx += widths[i];
                            });
                            y += 4;
                          });
                          doc.save("Reporte-Rotacion-Inventario.pdf");
                          toast.success("PDF descargado");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]"
                      >
                        <FileText size={14} /> Exportar PDF
                      </button>
                      <button
                        onClick={() => {
                          setRotationExportOpen(false);
                          const headers = ["Producto", "Código", "Submarca", "Stock", "Días en Inv.", "Velocidad", "Proy. Agot.", "Estado", "Capital"];
                          const rows = rotationData.map((item: any) => {
                            const proy = item.velocidadDias > 0 && item.stock > 0 ? `${Math.round(item.velocidadDias * item.stock)} días` : "—";
                            const el = item.diasEnInventario >= 999 ? "Sin movimientos" :
                              item.diasEnInventario <= 15 ? "Rotación alta" :
                              item.diasEnInventario <= 60 ? "Rotación media" : "Rotación baja";
                            const cap = ((item.costoPromedio || 0) * (item.stock || 0)).toLocaleString();
                            return [
                              item.name || "—",
                              item.code || "",
                              item.subbrand || "—",
                              String(item.stock || 0),
                              item.diasEnInventario >= 999 ? "—" : String(item.diasEnInventario),
                              item.velocidadDias > 0 ? `${item.velocidadDias} días/venta` : "Sin ventas",
                              proy,
                              el,
                              `${cap} RD$`,
                            ];
                          });
                          const csv = [headers.join(","), ...rows.map((r: string[]) => r.map(v => `"${v}"`).join(","))].join("\n");
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                          const link = document.createElement("a");
                          link.href = URL.createObjectURL(blob);
                          link.download = "Reporte-Rotacion-Inventario.csv";
                          link.click();
                          toast.success("CSV descargado");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]"
                      >
                        <FileText size={14} /> Exportar CSV
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Rotation Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Submarca</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Días en Inv.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Velocidad</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Proy. Agot.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Última Ref.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Recom.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Capital</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Ocultar</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let filtered = rotationData.filter((d: any) => showHiddenRotation || !hiddenRotationIds.includes(d.product_id));
                    if (rotationFilterSubbrand) filtered = filtered.filter((d: any) => d.subbrand === rotationFilterSubbrand);
                    if (rotationFilterDays) {
                      const [min, max] = rotationFilterDays.split("-").map(Number);
                      filtered = filtered.filter((d: any) => d.diasEnInventario >= min && d.diasEnInventario <= max);
                    }
                    if (rotationFilterStatus) {
                      filtered = filtered.filter((d: any) => {
                        if (rotationFilterStatus === "success") return d.diasEnInventario <= 15;
                        if (rotationFilterStatus === "warning") return d.diasEnInventario > 15 && d.diasEnInventario <= 60;
                        if (rotationFilterStatus === "danger") return d.diasEnInventario > 60 || d.diasEnInventario >= 999;
                        return true;
                      });
                    }
                    return filtered
                      .sort((a: any, b: any) => b.diasEnInventario - a.diasEnInventario)
                      .map((item: any) => {
                        const velocidad = item.velocidadDias > 0
                          ? `${item.velocidadDias} días/venta`
                          : "Sin ventas";
                        const proyAgot = item.velocidadDias > 0 && item.stock > 0
                          ? Math.round(item.velocidadDias * item.stock)
                          : null;
                        const proyColor = proyAgot === null ? "text-[#9C8A82]" :
                          proyAgot < 30 ? "text-red-500" :
                          proyAgot < 60 ? "text-[#E8C87A]" : "text-[#86C7A3]";
                        const capital = ((item.costoPromedio || 0) * (item.stock || 0));
                        const estadoLabel = item.diasEnInventario >= 999 ? "Sin movimientos" :
                          item.diasEnInventario <= 15 ? "Rotación alta" :
                          item.diasEnInventario <= 60 ? "Rotación media" : "Rotación baja";
                        const estadoVariant = item.diasEnInventario >= 999 ? "danger" :
                          item.diasEnInventario <= 15 ? "success" :
                          item.diasEnInventario <= 60 ? "warning" : "danger";

                        // Auto-recommendations per row
                        const recoms: { label: string; variant: "success" | "warning" | "danger" }[] = [];
                        if (item.diasEnInventario > 90 && item.diasEnInventario < 999) recoms.push({ label: "Liquidar", variant: "danger" });
                        if (proyAgot !== null && proyAgot < 30) recoms.push({ label: "Reponer", variant: "warning" });
                        if (item.diasEnInventario >= 999) recoms.push({ label: "Sin mov.", variant: "danger" });

                        return (
                          <tr
                            key={item.id}
                            className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow cursor-pointer"
                            onClick={async () => {
                              setRotationDetailProductId(item.product_id);
                              setRotationDetailItem(item);
                              setRotationDetailLoading(true);
                              try {
                                const movs = await getInventoryMovements(item.product_id);
                                setRotationDetailMovements(movs);
                              } catch {
                                setRotationDetailMovements([]);
                              } finally {
                                setRotationDetailLoading(false);
                              }
                            }}
                          >
                            <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{item.products?.subbrands?.name || "—"}</td>
                            <td className="px-4 py-3.5 text-sm text-[#5C3E35] font-medium">
                              {item.products?.name || "—"}
                              <span className="ml-2 text-xs text-[#9C8A82]">{item.products?.code}</span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-center">{item.stock || 0}</td>
                            <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-center font-medium">
                              {item.diasEnInventario >= 999 ? "—" : item.diasEnInventario}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-[#9C8A82] text-center">{velocidad}</td>
                            <td className={`px-4 py-3.5 text-sm text-center font-medium ${proyColor}`}>
                              {proyAgot === null ? "—" : `${proyAgot} días`}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-[#9C8A82] text-center">{item.ultimaReferencia}</td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex flex-wrap gap-1 justify-center">
                                {recoms.length === 0 ? (
                                  <span className="text-xs text-[#9C8A82]">—</span>
                                ) : recoms.map((r, i) => (
                                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    r.variant === "danger" ? "bg-red-50 text-red-600" :
                                    r.variant === "warning" ? "bg-yellow-50 text-yellow-700" :
                                    "bg-green-50 text-green-600"
                                  }`}>{r.label}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge variant={estadoVariant}>{estadoLabel}</Badge>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{capital.toLocaleString()} RD$</td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleHideRotationProduct(item.product_id);
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                                  hiddenRotationIds.includes(item.product_id)
                                    ? "bg-[#B8837E]/10 text-[#B8837E]"
                                    : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                                }`}
                              >
                                <EyeOff size={12} className="inline mr-1" />
                                {hiddenRotationIds.includes(item.product_id) ? "Mostrar" : "Ocultar"}
                              </button>
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Rotation detail modal */}
      <Modal isOpen={!!rotationDetailProductId} onClose={() => { setRotationDetailProductId(null); setRotationDetailItem(null); }} title={rotationDetailItem?.name || "Detalle del Producto"} wide>
        {rotationDetailLoading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {rotationDetailItem && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Stock actual</p>
                    <p className="text-xl font-bold text-[#5C3E35]">{rotationDetailItem.stock || 0}</p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Días en inventario</p>
                    <p className="text-xl font-bold text-[#5C3E35]">
                      {rotationDetailItem.diasEnInventario >= 999 ? "—" : rotationDetailItem.diasEnInventario}
                    </p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Velocidad de venta</p>
                    <p className="text-xl font-bold text-[#5C3E35]">
                      {rotationDetailItem.velocidadDias > 0 ? `${rotationDetailItem.velocidadDias} días` : "—"}
                    </p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Proy. agotamiento</p>
                    <p className={`text-xl font-bold ${
                      rotationDetailItem.velocidadDias > 0 && rotationDetailItem.stock > 0
                        ? Math.round(rotationDetailItem.velocidadDias * rotationDetailItem.stock) < 30
                          ? "text-red-500" : "text-[#86C7A3]"
                        : "text-[#9C8A82]"
                    }`}>
                      {rotationDetailItem.velocidadDias > 0 && rotationDetailItem.stock > 0
                        ? `${Math.round(rotationDetailItem.velocidadDias * rotationDetailItem.stock)} días`
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Timeline info */}
                <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Última referencia</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.ultimaReferencia}</span>
                  </div>
                  {rotationDetailItem.firstPurchase && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Primera compra</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.firstPurchase)}</span>
                    </div>
                  )}
                  {rotationDetailItem.last_purchase && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Última compra</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.last_purchase)}</span>
                    </div>
                  )}
                  {rotationDetailItem.last_sale && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Última venta</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.last_sale)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Total vendido</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.sold || 0} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Total comprado</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.purchased || 0} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Capital inmovilizado</span>
                    <span className="text-[#5C3E35] font-medium">{((rotationDetailItem.costoPromedio || 0) * (rotationDetailItem.stock || 0)).toLocaleString()} RD$</span>
                  </div>
                </div>
              </>
            )}

            {/* Movements */}
            <div>
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Movimientos de inventario</h4>
              {rotationDetailMovements.length === 0 ? (
                <p className="text-sm text-[#9C8A82] py-4 text-center">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rotationDetailMovements.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className={`text-sm font-medium ${movementColor[m.movement_type] || ""}`}>
                          {movementLabel[m.movement_type] || m.movement_type}
                        </p>
                        {m.notes && <p className="text-xs text-[#9C8A82]">{m.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">
                          {m.movement_type === "PURCHASE" ? "+" : m.movement_type === "SALE" ? "-" : ""}
                          {m.quantity}
                        </p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
