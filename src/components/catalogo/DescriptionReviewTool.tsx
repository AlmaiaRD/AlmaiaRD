"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getProducts, updateProduct } from "@/services/products";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Search, RefreshCw, Save, Download } from "lucide-react";
import toast from "react-hot-toast";

interface ReviewedProduct {
  id: string;
  name: string;
  code: string;
  category?: string;
  subcategory: string;
  description: string;
  benefits: string;
  originalDescription: string;
  originalBenefits: string;
  expanded: boolean;
  approved: "keep" | "edit" | "skip";
}

function detectIssue(desc: string, benefits: string, name: string) {
  const issues: string[] = [];
  const hay = `${desc}\n${benefits}`.toLowerCase();
  if (!desc.trim() && !benefits.trim()) issues.push("Sin descripción ni beneficios");
  else {
    if (!desc.trim()) issues.push("Sin descripción");
    if (!benefits.trim()) issues.push("Sin beneficios");
  }
  if (desc.trim().length < 40) issues.push("Descripción muy corta");
  if (/leer\s*más|ver\s*más|expandir/i.test(hay)) issues.push("Contiene 'leer más/ver más'");
  if (/\b(undefined|null|nan)\b/i.test(hay)) issues.push("Contiene valores vacíos (undefined/null)");
  if (name && hay && !hay.includes(name.toLowerCase().split(" ")[0])) issues.push("La descripción no menciona el nombre del producto");
  return issues;
}

function cleanText(text: string): string {
  return (text || "")
    .replace(/\b(leer\s+más|ver\s+más|mostrar\s+más|expandir)\b/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeBenefits(text: string): string {
  if (!text.trim()) return text;
  if (text.includes("\n")) return text;
  const items = text
    .split(/[.;•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.join("\n");
}

function buildSuggestion(desc: string, benefits: string) {
  const cleanDesc = cleanText(desc);
  const cleanBen = normalizeBenefits(cleanText(benefits));
  return { description: cleanDesc, benefits: cleanBen };
}

export default function DescriptionReviewTool({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ReviewedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProducts(true);
      const mapped: ReviewedProduct[] = (data as any[]).map((p) => ({
        id: p.id,
        name: p.name || "Sin nombre",
        code: p.code || "",
        category: p.categories?.name || "",
        subcategory: p.subcategory || "",
        description: p.description || "",
        benefits: p.benefits || "",
        originalDescription: p.description || "",
        originalBenefits: p.benefits || "",
        expanded: false,
        approved: detectIssue(p.description || "", p.benefits || "", p.name || "").length === 0 ? "keep" : "edit",
      }));
      setRows(mapped);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    load().then(() => {
      if (!cancelled) {
        // loaded
      }
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.code || "").toLowerCase().includes(s) ||
        (r.category || "").toLowerCase().includes(s)
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const issues = rows.filter((r) => r.approved === "edit").length;
    const ok = rows.filter((r) => r.approved === "keep").length;
    return { issues, ok, total: rows.length };
  }, [rows]);

  function toggle(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));
  }

  function updateRow(id: string, patch: Partial<ReviewedProduct>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function applySuggestion(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const sug = buildSuggestion(row.originalDescription, row.originalBenefits);
    updateRow(id, { description: sug.description, benefits: sug.benefits, approved: "edit" });
  }

  function markKeep(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    updateRow(id, {
      approved: "keep",
      description: row.originalDescription,
      benefits: row.originalBenefits,
    });
  }

  async function handleApplyAll() {
    const toApply = rows.filter((r) => r.approved === "edit");
    if (toApply.length === 0) {
      toast("No hay cambios para aplicar");
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    for (const r of toApply) {
      const changed =
        r.description !== r.originalDescription || r.benefits !== r.originalBenefits;
      if (!changed) continue;
      try {
        await updateProduct(r.id, {
          description: r.description || null,
          benefits: r.benefits || null,
        } as any);
        ok++;
        updateRow(r.id, { originalDescription: r.description, originalBenefits: r.benefits, approved: "keep" });
      } catch {
        fail++;
      }
    }
    setSaving(false);
    if (ok > 0) toast.success(`${ok} producto(s) actualizado(s)`);
    if (fail > 0) toast.error(`${fail} no se pudieron actualizar`);
    if (ok === 0 && fail === 0) toast("Sin cambios que aplicar");
  }

  function exportCsv() {
    const header = ["Nombre", "Código", "Categoría", "Descripción", "Beneficios", "Observaciones"];
    const lines = [header.join(";")];
    for (const r of rows) {
      const issues = detectIssue(r.description, r.benefits, r.name).join(" | ");
      const esc = (s: string | undefined) => `"${(s || "").replace(/"/g, '""')}"`;
      lines.push([esc(r.name), esc(r.code), esc(r.category), esc(r.description), esc(r.benefits), esc(issues)].join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventario-descripciones.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Inventario exportado");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      wide
      title="Revisión de Descripciones"
      subtitle="Revisa y corrige las descripciones y beneficios de todos los productos antes de aplicar"
    >
      <div className="space-y-4">        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#5C3E35]">
            <Badge variant="warning">{counts.issues} con observaciones</Badge>
            <Badge variant="success">{counts.ok} ok</Badge>
            <span className="text-[#9C8A82]">{counts.total} productos</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-center text-[#9C8A82] py-10 text-sm">No hay productos para revisar</p>
            ) : (
              filtered.map((r) => {
                const issues = detectIssue(r.description, r.benefits, r.name);
                const hasChanges = r.description !== r.originalDescription || r.benefits !== r.originalBenefits;
                return (
                  <div key={r.id} className="border border-[#E8E0D8] rounded-xl overflow-hidden bg-white">
                    <div className="flex items-center gap-3 p-3 bg-[#FAF6F0]">
                      <button onClick={() => toggle(r.id)} className="text-[#5C3E35] hover:bg-[#E8E0D8] rounded p-1 transition-colors">
                        {r.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#5C3E35] truncate">{r.name}</div>
                        <div className="text-xs text-[#9C8A82]">
                          {r.code && `Código: ${r.code}`}
                          {r.category ? ` · ${r.category}` : ""}
                          {r.subcategory ? ` · ${r.subcategory}` : ""}
                        </div>
                      </div>
                      {issues.length > 0 ? (
                        <div className="flex items-center gap-1 text-amber-600 text-xs" title={issues.join(". ")}>
                          <AlertTriangle size={15} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => applySuggestion(r.id)}
                          disabled={!issues.some((i) => /leer|valores|vacío|sin descripción|muy corta/i.test(i)) && issues.length === 0}
                          className="text-xs px-2 py-1 rounded-md bg-white border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0] disabled:opacity-40"
                          title="Aplicar limpieza automática"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => markKeep(r.id)}
                          className={`text-xs px-2 py-1 rounded-md border flex-shrink-0 transition-colors ${r.approved === "keep" ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0]"}`}
                        >
                          Dejar igual
                        </button>
                      </div>
                    </div>

                    {r.expanded && (
                      <div className="p-3 space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-[#5C3E35]">Descripción</label>
                            <span className="text-[10px] text-[#9C8A82]">{r.description.length} car.</span>
                          </div>
                          <textarea
                            value={r.description}
                            onChange={(e) => updateRow(r.id, { description: e.target.value, approved: "edit" })}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] resize-y"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-[#5C3E35]">Beneficios <span className="text-[#9C8A82] font-normal">(uno por línea)</span></label>
                            <span className="text-[10px] text-[#9C8A82]">{r.benefits.length} car.</span>
                          </div>
                          <textarea
                            value={r.benefits}
                            onChange={(e) => updateRow(r.id, { benefits: e.target.value, approved: "edit" })}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] resize-y"
                          />
                        </div>

                        {issues.length > 0 && (
                          <div className="bg-[#FFF9F0] border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                            <ul className="list-disc list-inside space-y-0.5">
                              {issues.map((iss, i) => (
                                <li key={i}>{iss}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hasChanges && (
                          <div className="text-xs text-[#B8837E] flex items-center gap-1">
                            <Save size={13} /> Hay cambios sin aplicar
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E8E0D8]">
          <div className="text-xs text-[#9C8A82]">
            {rows.filter((r) => r.approved === "edit" && (r.description !== r.originalDescription || r.benefits !== r.originalBenefits)).length} producto(s) con cambios por aplicar
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#5C3E35] border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <Download size={16} /> Exportar inventario
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#5C3E35] hover:bg-[#FAF6F0] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApplyAll}
              disabled={saving || rows.filter((r) => r.approved === "edit" && (r.description !== r.originalDescription || r.benefits !== r.originalBenefits)).length === 0}
              className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#9A6B66] transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Aplicar cambios"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
