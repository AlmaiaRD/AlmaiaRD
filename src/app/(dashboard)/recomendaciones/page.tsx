"use client";

import { useState, useEffect, useCallback } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { normalize } from "@/lib/search";
import {
  getProductRecommendations,
  getClientRecommendations,
  getSeasonalRecommendations,
  getSeasonFromMonth,
  getAIRecommendations,
  getAISeasonalRecommendations,
  type ProductRecommendation,
  type ClientRecommendation,
  type Season,
} from "@/services/recommendations";
import {
  ArrowLeft,
  Brain,
  Sparkles,
  Users,
  Package,
  Sun,
  Cloud,
  Snowflake,
  Flower2,
  AlertTriangle,
  CheckCircle,
  Search,
  Lightbulb,
  X,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const SEASONS: { key: Season; label: string; icon: any; color: string; bgColor: string; description: string }[] = [
  { key: "verano", label: "Verano", icon: Sun, color: "text-orange-500", bgColor: "bg-orange-50", description: "Prot solar, hidratación, energía" },
  { key: "invierno", label: "Invierno", icon: Snowflake, color: "text-blue-500", bgColor: "bg-blue-50", description: "Inmunidad, vitaminas, cuidado piel" },
  { key: "primavera", label: "Primavera", icon: Flower2, color: "text-green-500", bgColor: "bg-green-50", description: "Limpieza, renovación, energía" },
  { key: "otoño", label: "Otoño", icon: Cloud, color: "text-amber-500", bgColor: "bg-amber-50", description: "Hidratación, transición, cuidado" },
];

const SUGGESTED_NEEDS = [
  "Nutrición", "Belleza", "Cabello", "Hogar", "Salud", "Dientes", "Piel",
  "Proteínas", "Vitaminas", "Cuidado personal", "Limpieza", "Energía",
  "Deporte", "Peso", "Anticelulitis", "Bebé",
];

export default function RecommendationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [productRecs, setProductRecs] = useState<ProductRecommendation[]>([]);
  const [clientRecs, setClientRecs] = useState<ClientRecommendation[]>([]);
  const [seasonalRecs, setSeasonalRecs] = useState<ProductRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "clients" | "seasonal" | "needs">("needs");
  const [customNeed, setCustomNeed] = useState("");
  const [customRecs, setCustomRecs] = useState<ProductRecommendation[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season>(getSeasonFromMonth(new Date().getMonth() + 1));
  const [searchFilter, setSearchFilter] = useState("");
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [products, clients] = await Promise.all([
        getProductRecommendations(["nutricion", "belleza", "cabello", "hogar"]),
        getClientRecommendations(),
      ]);
      setProductRecs(products);
      setClientRecs(clients);
      // Load seasonal with AI
      await loadSeasonalAI(selectedSeason);
    } catch {
      // Fallback to local
      const seasonal = await getSeasonalRecommendations(selectedSeason);
      setSeasonalRecs(seasonal);
    } finally {
      setLoading(false);
    }
  }, [selectedSeason]);

  async function loadSeasonalAI(season: Season) {
    try {
      const recs = await getAISeasonalRecommendations(season);
      setSeasonalRecs(recs);
      setAiAvailable(true);
    } catch {
      // Fallback to local matching
      const recs = await getSeasonalRecommendations(season);
      setSeasonalRecs(recs);
      setAiAvailable(false);
    }
  }

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSearch() {
    if (!customNeed.trim()) {
      setCustomRecs([]);
      return;
    }
    setAiLoading(true);
    setLoading(true);
    try {
      // Try AI first
      try {
        const recs = await getAIRecommendations(customNeed);
        setCustomRecs(recs);
        setAiAvailable(true);
        if (recs.length === 0) {
          toast("La IA no encontró productos específicos para esa necesidad", { icon: "🔍" });
        }
      } catch {
        // Fallback to local matching
        setAiAvailable(false);
        const needs = customNeed.split(",").map((n) => n.trim()).filter(Boolean);
        const recs = await getProductRecommendations(needs);
        setCustomRecs(recs);
        if (recs.length === 0) {
          toast("No se encontraron productos para esa necesidad", { icon: "🔍" });
        }
      }
    } catch {
      toast.error("Error al buscar");
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  }

  function clearSearch() {
    setCustomNeed("");
    setCustomRecs([]);
  }

  const filteredProducts = productRecs.filter((r) => {
    if (!searchFilter) return true;
    const q = normalize(searchFilter);
    return normalize(r.product_name || "").includes(q) || normalize(r.subbrand || "").includes(q) || normalize(r.reason || "").includes(q);
  });

  const filteredSeasonal = seasonalRecs.filter((r) => {
    if (!searchFilter) return true;
    const q = normalize(searchFilter);
    return normalize(r.product_name || "").includes(q) || normalize(r.subbrand || "").includes(q);
  });

  function getPriorityColor(priority: string) {
    switch (priority) {
      case "high": return "bg-red-50 text-red-600 border-red-200";
      case "medium": return "bg-amber-50 text-amber-600 border-amber-200";
      case "low": return "bg-green-50 text-green-600 border-green-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/catalogo")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver al Catálogo
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#5C3E35]">Recomendaciones IA</h1>
            <p className="text-sm text-[#9C8A82]">Sugerencias inteligentes para tu negocio</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E8E0D8] pb-2 flex-wrap">
        {[
          { key: "needs", label: "Por Necesidad", icon: Lightbulb },
          { key: "products", label: "Productos", icon: Package },
          { key: "clients", label: "Clientes", icon: Users },
          { key: "seasonal", label: "Temporada", icon: Sun },
        ].map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key as any); setSearchFilter(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? "bg-[#B8837E]/10 text-[#B8837E]" : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* ===================== PRODUCTS TAB ===================== */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar productos recomendados..."
                  className="w-full h-12 pl-12 pr-10 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                {searchFilter && <button onClick={() => setSearchFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C8A82] hover:text-[#5C3E35]"><X size={16} /></button>}
              </div>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-[#9C8A82]"><Sparkles size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">{searchFilter ? "No se encontraron resultados" : "No hay recomendaciones"}</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map((rec) => (
                    <div key={rec.product_id} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md ${getPriorityColor(rec.priority)}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div><p className="font-medium text-[#5C3E35]">{rec.product_name}</p><p className="text-xs text-[#9C8A82]">{rec.code} · {rec.subbrand}</p></div>
                        <span className={`text-xs px-2 py-1 rounded-full ${rec.priority === "high" ? "bg-red-100 text-red-700" : rec.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                        </span>
                      </div>
                      <p className="text-sm text-[#5C3E35]">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== CLIENTS TAB ===================== */}
          {activeTab === "clients" && (
            <div className="space-y-4">
              {clientRecs.length === 0 ? (
                <div className="text-center py-16 text-[#9C8A82]"><CheckCircle size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Todos los clientes están al día</p></div>
              ) : (
                <div className="space-y-3">
                  {clientRecs.map((rec) => (
                    <div key={`${rec.client_id}-${rec.action}`} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rec.priority === "high" ? "bg-red-50" : "bg-amber-50"}`}>
                          {rec.priority === "high" ? <AlertTriangle size={18} className="text-red-500" /> : <Users size={18} className="text-amber-500" />}
                        </div>
                        <div><p className="text-sm font-medium text-[#5C3E35]">{rec.client_name}</p><p className="text-xs text-[#9C8A82]">{rec.action}</p></div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${rec.priority === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{rec.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== SEASONAL TAB ===================== */}
          {activeTab === "seasonal" && (
            <div className="space-y-4">
              {/* Season Selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {SEASONS.map((season) => {
                  const SeasonIcon = season.icon;
                  return (
                    <button
                      key={season.key}
                      onClick={() => { setSelectedSeason(season.key); loadSeasonalAI(season.key); }}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedSeason === season.key
                          ? `border-[#B8837E] ${season.bgColor} shadow-sm`
                          : "border-[#E8E0D8] bg-white hover:border-[#B8837E]/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <SeasonIcon size={18} className={selectedSeason === season.key ? season.color : "text-[#9C8A82]"} />
                        <span className={`text-sm font-semibold ${selectedSeason === season.key ? "text-[#5C3E35]" : "text-[#9C8A82]"}`}>
                          {season.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#9C8A82]">{season.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar productos..."
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>

              {filteredSeasonal.length === 0 ? (
                <div className="text-center py-16 text-[#9C8A82]">
                  <Sparkles size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No hay recomendaciones para esta temporada</p>
                  <p className="text-xs mt-1">Intenta seleccionar otra estación</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSeasonal.map((rec) => (
                    <div key={rec.product_id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div><p className="font-medium text-[#5C3E35]">{rec.product_name}</p><p className="text-xs text-[#9C8A82]">{rec.code} · {rec.subbrand}</p></div>
                      </div>
                      <p className="text-sm text-[#5C3E35]">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== NEEDS TAB ===================== */}
          {activeTab === "needs" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#5C3E35]">¿Qué necesitas?</h3>
                  {aiAvailable !== null && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${aiAvailable ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
                      {aiAvailable ? "IA Activada" : "Modo Local"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9C8A82] mb-4">Describe la necesidad y la IA te sugiere los mejores productos del catálogo.</p>
                <div className="flex gap-3 mb-4">
                  <input type="text" value={customNeed} onChange={(e) => setCustomNeed(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Ej: Necesito algo para el cabello dañado, vitaminas para energía"
                    className="flex-1 h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                  {customNeed && <button onClick={clearSearch} className="p-2 text-[#9C8A82] hover:text-[#5C3E35]"><X size={18} /></button>}
                  <button onClick={handleSearch} disabled={!customNeed.trim() || loading}
                    className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">
                    {aiLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={16} />}
                    {aiLoading ? "IA Pensando..." : "Buscar"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_NEEDS.map((need) => (
                    <button key={need} onClick={() => { setCustomNeed((prev) => prev ? `${prev}, ${need}` : need); }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#FAF6F0] text-[#5C3E35] hover:bg-[#B8837E]/10 hover:text-[#B8837E] transition-all">
                      {need}
                    </button>
                  ))}
                </div>
              </div>

              {customRecs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#5C3E35]">Resultados para &quot;{customNeed}&quot;</h3>
                    <button onClick={clearSearch} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] flex items-center gap-1">
                      <RefreshCw size={12} /> Limpiar
                    </button>
                  </div>
                  {customRecs.map((rec) => (
                    <div key={rec.product_id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#B8837E]/10 flex items-center justify-center"><Package size={18} className="text-[#B8837E]" /></div>
                        <div><p className="text-sm font-medium text-[#5C3E35]">{rec.product_name}</p><p className="text-xs text-[#9C8A82]">{rec.code} · {rec.subbrand}</p><p className="text-xs text-[#B8837E]">{rec.reason}</p></div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${rec.priority === "high" ? "bg-red-100 text-red-700" : rec.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {customNeed && customRecs.length === 0 && !loading && (
                <div className="text-center py-8 text-[#9C8A82]">
                  <Search size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Presiona &quot;Buscar&quot; para obtener recomendaciones</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
