"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import { getDocuments } from "@/services/documents";
import { FileText, Search, Eye, Download, File, Receipt, ShoppingCart, ArrowLeft, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import { normalize } from "@/lib/search";

interface Document {
  id: string;
  type: "Factura" | "Recibo" | "Compra";
  number: string;
  client?: string;
  supplier?: string;
  date: string;
  total: number;
  status: string;
}

interface GuideFile {
  id: string;
  label: string;
  filename: string;
  content: string;
}

interface GuideGroup {
  id: string;
  label: string;
  files: GuideFile[];
}

const FILTERS = ["Todos", "Facturas", "Recibos", "Compras"] as const;
const TABS = [
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "guides", label: "Guías de Ayuda", icon: BookOpen },
] as const;

function typeIcon(type: string) {
  if (type === "Factura") return FileText;
  if (type === "Recibo") return Receipt;
  return ShoppingCart;
}

function typeColor(type: string) {
  if (type === "Factura") return "bg-blue-50 text-blue-600";
  if (type === "Recibo") return "bg-green-50 text-green-600";
  return "bg-amber-50 text-amber-600";
}

function statusColor(status: string) {
  if (status === "Pagada" || status === "Emitido" || status === "Registrada") return "text-green-600 bg-green-50";
  if (status === "Pendiente") return "text-amber-600 bg-amber-50";
  if (status === "Parcial") return "text-blue-600 bg-blue-50";
  return "text-[#9C8A82] bg-[#FAF6F0]";
}

export default function DocumentosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilter, setCurrentFilter] = useState<string>("Todos");
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<GuideGroup[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const data = await getDocuments();
        setDocs(data);
      } catch {
        toast.error("Error al cargar documentos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (activeTab === "guides") {
      setLoadingGuides(true);
      fetch("/api/guides")
        .then((r) => r.json())
        .then((data) => setGuides(data.groups || []))
        .catch(() => toast.error("Error al cargar guías"))
        .finally(() => setLoadingGuides(false));
    }
  }, [activeTab]);

  const filtered = docs.filter((d) => {
    const matchesSearch = normalize(d.number).includes(normalize(searchQuery))
      || normalize(d.client || d.supplier || "").includes(normalize(searchQuery));
    const matchesFilter = currentFilter === "Todos" || d.type === currentFilter.slice(0, -1) as any;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    Todos: docs.length,
    Facturas: docs.filter((d) => d.type === "Factura").length,
    Recibos: docs.filter((d) => d.type === "Recibo").length,
    Compras: docs.filter((d) => d.type === "Compra").length,
  };

  function handleView(doc: Document) {
    if (doc.type === "Factura") router.push(`/facturacion`);
    else if (doc.type === "Recibo") router.push(`/recibos`);
    else router.push(`/compras`);
  }

  function handleDownload(doc: Document) {
    toast.success(`Descargando ${doc.type.toLowerCase()} ${doc.number}...`);
    if (doc.type === "Factura") router.push(`/facturacion`);
    else if (doc.type === "Recibo") router.push(`/recibos`);
    else router.push(`/compras`);
  }

  function toggleGuide(id: string) {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver al Dashboard
        </button>
        <h1 className="text-xl font-bold text-[#5C3E35]">Centro de Documentos</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Facturas, recibos, compras y guías de ayuda</p>
      </div>

      <div className="border-b border-[#E8E0D8] mb-6">
        <div className="flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-[#B8837E] border-b-2 border-[#B8837E]"
                    : "text-[#9C8A82] hover:text-[#5C3E35]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "documents" && (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setCurrentFilter(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  currentFilter === f ? "bg-[#B8837E] text-white shadow-sm" : "bg-white text-[#9C8A82] border border-[#E8E0D8] hover:text-[#5C3E35]"
                }`}>
                {f}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  currentFilter === f ? "bg-white/20" : "bg-[#FAF6F0]"
                }`}>{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, cliente o proveedor..."
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">{searchQuery || currentFilter !== "Todos" ? "Sin resultados" : "No hay documentos"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((doc) => {
                const Icon = typeIcon(doc.type);
                return (
                  <div key={doc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColor(doc.type)}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{doc.number}</p>
                        <p className="text-xs text-[#9C8A82]">{doc.client || doc.supplier} &middot; {formatDate(doc.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(doc.total)}</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${statusColor(doc.status)}`}>{doc.status}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(doc)}
                          className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "guides" && (
        <>
          {loadingGuides ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay guías disponibles</p>
            </div>
          ) : (
            <div className="space-y-6">
              {guides.map((group) => (
                <div key={group.id}>
                  <h3 className="text-sm font-semibold text-[#5C3E35] mb-3 uppercase tracking-wider">{group.label}</h3>
                  <div className="space-y-2">
                    {group.files.map((file) => {
                      const isExpanded = expandedGuides.has(file.id);
                      return (
                        <div key={file.id} className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] overflow-hidden">
                          <button
                            onClick={() => toggleGuide(file.id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-[#FAF6F0] transition-colors"
                          >
                            <span className="text-sm font-medium text-[#5C3E35]">{file.label}</span>
                            {isExpanded ? <ChevronDown size={16} className="text-[#9C8A82]" /> : <ChevronRight size={16} className="text-[#9C8A82]" />}
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="prose prose-sm max-w-none text-[#5C3E35] whitespace-pre-wrap font-mono text-xs leading-relaxed bg-[#FAF6F0] rounded-xl p-4 overflow-x-auto">
                                {file.content}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
