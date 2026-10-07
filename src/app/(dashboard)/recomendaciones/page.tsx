"use client";

import { useState, useEffect, useRef } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { normalize } from "@/lib/search";
import {
  getSeasonFromMonth,
  type ProductRecommendation,
  type Season,
} from "@/services/recommendations";
import {
  ArrowLeft,
  Brain,
  Sparkles,
  Package,
  Sun,
  Cloud,
  Snowflake,
  Flower2,
  Search,
  Lightbulb,
  X,
  Send,
  Bot,
  User,
  MessageCircle,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const SEASONS: { key: Season; label: string; icon: LucideIcon; color: string; bgColor: string; description: string }[] = [
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
  const [productRecsLoading, setProductRecsLoading] = useState(false);
  const [seasonalRecs, setSeasonalRecs] = useState<ProductRecommendation[]>([]);
  const [seasonalRecsLoading, setSeasonalRecsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "seasonal" | "needs">("needs");
  const [selectedSeason, setSelectedSeason] = useState<Season>(getSeasonFromMonth(new Date().getMonth() + 1));
  const [searchFilter, setSearchFilter] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string; recommendations?: ProductRecommendation[] }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiChatHistory");
      if (saved) try { return JSON.parse(saved); } catch { toast.error("Error al cargar historial"); }
    }
    return [];
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist chat to localStorage
  useEffect(() => {
    localStorage.setItem("aiChatHistory", JSON.stringify(chatMessages));
  }, [chatMessages]);

  function clearChat() {
    if (chatMessages.length === 0) return;
    if (window.confirm("¿Borrar todo el historial de la conversación?")) {
      setChatMessages([]);
      localStorage.removeItem("aiChatHistory");
      toast.success("Historial borrado");
    }
  }

  async function loadSeasonal(season: Season) {
    setSeasonalRecsLoading(true);
    try {
      const res = await fetch("/api/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `productos recomendados para ${season}`, season }),
      });
      if (res.ok) {
        const data = await res.json();
        setSeasonalRecs(data.recommendations || []);
      }
    } catch { toast.error("Error al cargar temporada"); } finally {
      setSeasonalRecsLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setProductRecsLoading(true);
      try {
        const res = await fetch("/api/ai-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "nutrición, belleza, cabello, hogar, salud, vitaminas, proteínas, cuidado personal, limpieza, energía" }),
        });
        if (res.ok) {
          const data = await res.json();
          setProductRecs(data.recommendations || []);
        }
      } catch { toast.error("Error al cargar recomendaciones"); } finally {
        setProductRecsLoading(false);
      }
    })();
    (async () => {
      setSeasonalRecsLoading(true);
      try {
        const res = await fetch("/api/ai-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `productos recomendados para ${selectedSeason}`, season: selectedSeason }),
        });
        if (res.ok) {
          const data = await res.json();
          setSeasonalRecs(data.recommendations || []);
        }
      } catch { toast.error("Error al cargar temporada"); } finally {
        setSeasonalRecsLoading(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedSeason ya se recarga explícitamente en su control (loadSeasonal); añadirla duplicaría el fetch
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleChatSend(message?: string) {
    const text = (message || chatInput).trim();
    if (!text) return;

    setChatInput("");
    setChatLoading(true);
    const userMsg = { role: "user" as const, content: text };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const [chatRes, productRes] = await Promise.all([
        fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        }),
        fetch("/api/ai-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        }).then((r) => r.ok ? r.json() : { recommendations: [] }),
      ]);
      const prodRecs = productRes.recommendations || [];

      if (chatRes.ok) {
        const data = await chatRes.json();
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            recommendations: prodRecs.length > 0 ? prodRecs : undefined,
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: prodRecs.length > 0
              ? "Encontré estos productos que podrían interesarte:"
              : "Lo siento, no pude procesar tu consulta. Intenta de nuevo.",
            recommendations: prodRecs.length > 0 ? prodRecs : undefined,
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ocurrió un error. Intenta de nuevo." },
      ]);
    } finally {
      setChatLoading(false);
    }
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
        <button onClick={() => router.push("/catalogo")} className="flex items-center gap-2 text-sm text-[#5F6B72] hover:text-[#39484F] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver al Catálogo
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-[30px] font-marca text-[#39484F]">Recomendaciones IA</h1>
            <p className="text-sm text-[#5F6B72]">Sugerencias inteligentes para tu negocio</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E0DAD3] pb-2 flex-wrap">
          {[
            { key: "needs", label: "Asistente IA", icon: Lightbulb },
            { key: "products", label: "Productos", icon: Package },
            { key: "seasonal", label: "Temporada", icon: Sun },
          ].map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key as "products" | "seasonal" | "needs"); setSearchFilter(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? "bg-[#BA4A3A]/10 text-[#BA4A3A]" : "text-[#5F6B72] hover:text-[#39484F] hover:bg-[#F1E9DF]"}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* ===================== PRODUCTS TAB ===================== */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6B72]" />
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar productos recomendados..."
                  className="w-full h-12 pl-12 pr-10 rounded-xl border border-[#E0DAD3] bg-white text-[#39484F] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
                {searchFilter && <button onClick={() => setSearchFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B72] hover:text-[#39484F]"><X size={16} /></button>}
              </div>
              {productRecsLoading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-[#5F6B72]"><Sparkles size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">{searchFilter ? "No se encontraron resultados" : "No hay recomendaciones"}</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map((rec) => (
                    <div key={rec.product_id} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md ${getPriorityColor(rec.priority)}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div><p className="font-medium text-[#39484F]">{rec.product_name}</p><p className="text-xs text-[#5F6B72]">{rec.code} · {rec.subbrand}</p></div>
                        <span className={`text-xs px-2 py-1 rounded-full ${rec.priority === "high" ? "bg-red-100 text-red-700" : rec.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                        </span>
                      </div>
                      <p className="text-sm text-[#39484F]">{rec.reason}</p>
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
                      onClick={() => { setSelectedSeason(season.key); loadSeasonal(season.key); }}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedSeason === season.key
                          ? `border-[#BA4A3A] ${season.bgColor} shadow-sm`
                          : "border-[#E0DAD3] bg-white hover:border-[#BA4A3A]/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <SeasonIcon size={18} className={selectedSeason === season.key ? season.color : "text-[#5F6B72]"} />
                        <span className={`text-sm font-semibold ${selectedSeason === season.key ? "text-[#39484F]" : "text-[#5F6B72]"}`}>
                          {season.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#5F6B72]">{season.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B72]" />
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar productos..."
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-[#E0DAD3] bg-white text-[#39484F] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
              </div>

              {seasonalRecsLoading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" /></div>
              ) : filteredSeasonal.length === 0 ? (
                <div className="text-center py-16 text-[#5F6B72]">
                  <Sparkles size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No hay recomendaciones para esta temporada</p>
                  <p className="text-xs mt-1">Intenta seleccionar otra estación</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSeasonal.map((rec) => (
                    <div key={rec.product_id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E0DAD3] hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div><p className="font-medium text-[#39484F]">{rec.product_name}</p><p className="text-xs text-[#5F6B72]">{rec.code} · {rec.subbrand}</p></div>
                      </div>
                      <p className="text-sm text-[#39484F]">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== ASISTENTE IA TAB (chat) ===================== */}
          {activeTab === "needs" && (
            <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
              <div className="bg-white rounded-2xl shadow-sm border border-[#E0DAD3] flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E0DAD3] bg-[#F1E9DF]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#39484F]">Asistente IA</p>
                    <p className="text-xs text-[#5F6B72]">Describe tu situación y recibe recomendaciones</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {chatMessages.length > 0 && (
                      <button onClick={clearChat} className="p-1.5 text-[#5F6B72] hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg" title="Borrar historial">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <MessageCircle size={40} className="text-[#E0DAD3] mb-3" />
                      <p className="text-sm text-[#5F6B72] mb-1">¿En qué puedo ayudarte?</p>
                      <p className="text-xs text-[#5F6B72]/60">
                        Ej: &quot;Una madre lactante con estrés, ¿qué suplementos ofrecerle?&quot;
                      </p>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot size={14} className="text-white" />
                        </div>
                      )}
                      <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : "order-1"}`}>
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#BA4A3A] text-white rounded-br-md"
                            : "bg-[#F1E9DF] text-[#39484F] rounded-bl-md border border-[#E0DAD3]"
                        }`}>
                          {msg.content}
                        </div>

                        {/* Product cards after AI message */}
                        {msg.role === "assistant" && msg.recommendations && msg.recommendations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.recommendations.slice(0, 5).map((rec) => (
                              <div key={rec.product_id} className="bg-white rounded-xl p-3 border border-[#E0DAD3] shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-[#BA4A3A]/10 flex items-center justify-center flex-shrink-0">
                                      <Package size={14} className="text-[#BA4A3A]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-[#39484F] truncate">{rec.product_name}</p>
                                      <p className="text-[10px] text-[#5F6B72] truncate">{rec.code} · {rec.subbrand}</p>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    rec.priority === "high" ? "bg-red-50 text-red-600" :
                                    rec.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"
                                  }`}>
                                    {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#5F6B72] mt-1.5 leading-relaxed">{rec.reason}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-[#BA4A3A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={14} className="text-[#BA4A3A]" />
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <Bot size={14} className="text-white" />
                      </div>
                      <div className="bg-[#F1E9DF] rounded-2xl rounded-bl-md px-4 py-3 border border-[#E0DAD3]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#BA4A3A]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 rounded-full bg-[#BA4A3A]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 rounded-full bg-[#BA4A3A]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-[#E0DAD3] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_NEEDS.slice(0, 6).map((need) => (
                        <button key={need} onClick={() => handleChatSend(need)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#F1E9DF] text-[#5F6B72] hover:bg-[#BA4A3A]/10 hover:text-[#BA4A3A] transition-all">
                          {need}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !chatLoading && handleChatSend()}
                      placeholder="Describe tu situación..."
                      className="flex-1 h-12 px-4 rounded-xl border border-[#E0DAD3] bg-[#F5EFE9] text-[#39484F] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
                    <button onClick={() => handleChatSend()} disabled={!chatInput.trim() || chatLoading}
                      className="flex items-center gap-2 bg-[#BA4A3A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9C382A] transition-all shadow-sm disabled:opacity-50">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
