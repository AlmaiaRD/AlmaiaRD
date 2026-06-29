"use client";

import { useState, useEffect, useMemo } from "react";
import { normalize } from "@/lib/search";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getClientCardData, getClientTags, updateClient } from "@/services/clients";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search, ChevronDown, ChevronRight, Phone, Mail, Tag, ShoppingCart,
  Clock, DollarSign, TrendingUp, Calendar, AlertCircle, Users,
  UserPlus, MessageCircle, BarChart3, Star, Zap, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ClientCardData } from "@/types/database";

const STAGES = [
  { key: "lead", label: "Prospecto", icon: UserPlus, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "contacted", label: "Contactado", icon: MessageCircle, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "quote", label: "Cotización", icon: FileText, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "first_purchase", label: "1ra Compra", icon: ShoppingCart, color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "post_sale", label: "Postventa", icon: Clock, color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "active", label: "Cliente Activo", icon: TrendingUp, color: "text-green-500", bg: "bg-green-50", border: "border-green-200" },
  { key: "repurchase", label: "Recompra", icon: Zap, color: "text-[#86C7A3]", bg: "bg-[#86C7A3]/10", border: "border-[#86C7A3]/30" },
  { key: "vip", label: "VIP", icon: Star, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "inactive", label: "Inactivo", icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
];

const STAGE_LABELS: Record<string, string> = {};
STAGES.forEach(s => { STAGE_LABELS[s.key] = s.label; });

function StageBadge({ stage }: { stage: string }) {
  const s = STAGES.find(x => x.key === stage);
  if (!s) return <Badge variant="neutral">{stage}</Badge>;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
      <Icon size={12} />
      {s.label}
    </span>
  );
}

export default function PipelinePage() {
  const [clients, setClients] = useState<ClientCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [selectedClient, setSelectedClient] = useState<ClientCardData | null>(null);
  const [savingStage, setSavingStage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getClientCardData();
        setClients(data);
        const expanded: Record<string, boolean> = {};
        for (const s of STAGES) expanded[s.key] = s.key === "active" || s.key === "lead";
        setExpandedStages(expanded);
      } catch (e) {
        toast.error("Error al cargar pipeline");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = clients;
    if (searchQuery) {
      const q = normalize(searchQuery);
      result = result.filter(c =>
        normalize(c.full_name).includes(q) ||
        (c.phone && normalize(c.phone).includes(q)) ||
        (c.email && normalize(c.email).includes(q))
      );
    }
    if (filterStage) {
      result = result.filter(c => c.stage === filterStage);
    }
    return result;
  }, [clients, searchQuery, filterStage]);

  const grouped = useMemo(() => {
    const map: Record<string, ClientCardData[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const c of filtered) {
      if (map[c.stage]) map[c.stage].push(c);
      else map[c.stage] = [c];
    }
    return map;
  }, [filtered]);

  async function handleStageChange(clientId: string, newStage: string) {
    setSavingStage(clientId);
    try {
      await updateClient(clientId, { stage: newStage } as any);
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, stage: newStage } : c));
      toast.success("Etapa actualizada");
    } catch {
      toast.error("Error al actualizar etapa");
    } finally {
      setSavingStage(null);
    }
  }

  function toggleStage(key: string) {
    setExpandedStages(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Pipeline Comercial</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Ciclo de vida completo del cliente</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente por nombre, teléfono o email..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
          />
        </div>
        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value)}
          className="h-12 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
        >
          <option value="">Todas las etapas</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay clientes en esta etapa</p>
        </div>
      ) : (
        <div className="space-y-4">
          {STAGES.filter(s => grouped[s.key]?.length > 0 || !filterStage).map(stage => {
            const stageClients = grouped[stage.key] || [];
            if (filterStage && stage.key !== filterStage) return null;
            if (!filterStage && stageClients.length === 0) return null;
            const isExpanded = expandedStages[stage.key];
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleStage(stage.key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAF6F0] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stage.bg}`}>
                      <Icon size={20} className={stage.color} />
                    </div>
                    <span className="font-semibold text-[#5C3E35]">{stage.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>
                      {stageClients.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={20} className="text-[#9C8A82]" /> : <ChevronRight size={20} className="text-[#9C8A82]" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-[#E8E0D8] divide-y divide-[#F0EBE3]">
                    {stageClients.map(client => (
                      <div
                        key={client.id}
                        className="p-4 hover:bg-[#FCFAF7] transition-colors cursor-pointer"
                        onClick={() => setSelectedClient(client)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <h3 className="font-semibold text-[#5C3E35] truncate">{client.full_name}</h3>
                              {client.tags.slice(0, 3).map(t => (
                                <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#B8837E]/10 text-[#B8837E] font-medium whitespace-nowrap">
                                  {t.name}
                                </span>
                              ))}
                              {client.stage !== "vip" && client.total_spent >= 50000 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium whitespace-nowrap border border-amber-200">
                                  Sugerencia VIP
                                </span>
                              )}
                              {(client.stage === "active" || client.stage === "vip") && client.days_since_last_purchase !== null && client.days_since_last_purchase >= 90 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium whitespace-nowrap border border-gray-200">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9C8A82]">
                              {client.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={12} />
                                  {client.phone}
                                </span>
                              )}
                              {client.email && (
                                <span className="flex items-center gap-1">
                                  <Mail size={12} />
                                  {client.email}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <select
                              value={client.stage}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); handleStageChange(client.id, e.target.value); }}
                              disabled={savingStage === client.id}
                              className="h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-xs text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                            >
                              {STAGES.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div className="bg-[#FAF6F0] rounded-lg p-2.5">
                            <div className="flex items-center gap-1 text-[10px] text-[#9C8A82] mb-1">
                              <DollarSign size={12} />
                              Total gastado
                            </div>
                            <p className="text-sm font-semibold text-[#5C3E35]">{formatCurrency(client.total_spent)}</p>
                          </div>
                          <div className="bg-[#FAF6F0] rounded-lg p-2.5">
                            <div className="flex items-center gap-1 text-[10px] text-[#9C8A82] mb-1">
                              <ShoppingCart size={12} />
                              Compras
                            </div>
                            <p className="text-sm font-semibold text-[#5C3E35]">{client.num_purchases}</p>
                          </div>
                          <div className="bg-[#FAF6F0] rounded-lg p-2.5">
                            <div className="flex items-center gap-1 text-[10px] text-[#9C8A82] mb-1">
                              <Calendar size={12} />
                              {client.days_since_last_purchase !== null ? "Última compra" : "Registrado"}
                            </div>
                            <p className="text-sm font-semibold text-[#5C3E35]">
                              {client.last_purchase_date
                                ? formatDate(client.last_purchase_date)
                                : formatDate(client.created_at)}
                            </p>
                          </div>
                          <div className="bg-[#FAF6F0] rounded-lg p-2.5">
                            <div className="flex items-center gap-1 text-[10px] text-[#9C8A82] mb-1">
                              <Clock size={12} />
                              {client.days_since_last_purchase !== null ? "Días sin comprar" : "Antigüedad"}
                            </div>
                            <p className="text-sm font-semibold text-[#5C3E35]">
                              {client.days_since_last_purchase !== null
                                ? `${client.days_since_last_purchase}d`
                                : `${Math.floor((new Date().getTime() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24))}d`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#9C8A82]">
                          {client.pending_balance > 0 && (
                            <span className="flex items-center gap-1 font-medium text-[#D4A0A0]">
                              <DollarSign size={12} />
                              Saldo: {formatCurrency(client.pending_balance)}
                            </span>
                          )}
                          {client.pv_total > 0 && (
                            <span className="flex items-center gap-1">
                              <BarChart3 size={12} />
                              PV: {client.pv_total.toFixed(2)}
                            </span>
                          )}
                          {client.avg_ticket > 0 && (
                            <span className="flex items-center gap-1">
                              Ticket prom.: {formatCurrency(client.avg_ticket)}
                            </span>
                          )}
                          {client.top_products.length > 0 && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <Tag size={12} />
                              {client.top_products.map(p => p.name).join(", ")}
                            </span>
                          )}
                          {client.repurchase_date && (
                            <span className="flex items-center gap-1 text-[#86C7A3] font-medium">
                              <Zap size={12} />
                              Recompra estimada: {formatDate(client.repurchase_date)}
                            </span>
                          )}
                          {client.next_action && (
                            <span className="flex items-center gap-1 text-[#B8837E] font-medium">
                              <Calendar size={12} />
                              Próx: {client.next_action.description} ({formatDate(client.next_action.date)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.full_name || "Detalle del cliente"}
        wide
      >
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StageBadge stage={selectedClient.stage} />
                {selectedClient.tags.map(t => (
                  <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-[#B8837E]/10 text-[#B8837E] font-medium">{t.name}</span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedClient.stage}
                  onChange={e => handleStageChange(selectedClient.id, e.target.value)}
                  disabled={savingStage === selectedClient.id}
                  className="h-9 px-3 rounded-lg border border-[#E8E0D8] bg-white text-xs text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Contacto</h4>
                {selectedClient.phone && <p className="text-sm text-[#5C3E35] flex items-center gap-2"><Phone size={14} className="text-[#9C8A82]" /> {selectedClient.phone}</p>}
                {selectedClient.email && <p className="text-sm text-[#5C3E35] flex items-center gap-2"><Mail size={14} className="text-[#9C8A82]" /> {selectedClient.email}</p>}
                {selectedClient.lead_source && <p className="text-sm text-[#5C3E35] flex items-center gap-2"><UserPlus size={14} className="text-[#9C8A82]" /> Llegó por: {selectedClient.lead_source}</p>}
                {selectedClient.interest && <p className="text-sm text-[#5C3E35] flex items-center gap-2"><Tag size={14} className="text-[#9C8A82]" /> Interés: {selectedClient.interest}</p>}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Comercial</h4>
                <p className="text-sm text-[#5C3E35] flex items-center gap-2"><DollarSign size={14} className="text-[#9C8A82]" /> Total gastado: <strong>{formatCurrency(selectedClient.total_spent)}</strong></p>
                <p className="text-sm text-[#5C3E35] flex items-center gap-2"><ShoppingCart size={14} className="text-[#9C8A82]" /> Compras: <strong>{selectedClient.num_purchases}</strong></p>
                <p className="text-sm text-[#5C3E35] flex items-center gap-2"><BarChart3 size={14} className="text-[#9C8A82]" /> PV total: <strong>{selectedClient.pv_total.toFixed(2)}</strong></p>
                <p className="text-sm text-[#5C3E35] flex items-center gap-2"><TrendingUp size={14} className="text-[#9C8A82]" /> Ticket promedio: <strong>{formatCurrency(selectedClient.avg_ticket)}</strong></p>
                {selectedClient.repurchase_date && (
                  <p className="text-sm text-[#5C3E35] flex items-center gap-2"><Zap size={14} className="text-[#86C7A3]" /> Recompra estimada: <strong>{formatDate(selectedClient.repurchase_date)}</strong></p>
                )}
              </div>
            </div>

            {selectedClient.pending_balance > 0 && (
              <div className="bg-[#FFF5F5] border border-[#D4A0A0]/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#D4A0A0] flex items-center gap-2">
                  <DollarSign size={16} /> Saldo pendiente: {formatCurrency(selectedClient.pending_balance)}
                </p>
              </div>
            )}

            {selectedClient.top_products.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider mb-2">Productos favoritos</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedClient.top_products.map((p, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-[#FAF6F0] text-[#5C3E35] border border-[#E8E0D8]">
                      {p.name} ({p.count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedClient.next_action && (
              <div className="bg-[#FFFBEB] border border-[#E8C87A]/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#E8C87A] uppercase tracking-wider mb-1">Próxima acción</p>
                <p className="text-sm text-[#5C3E35]">{selectedClient.next_action.description}</p>
                <p className="text-xs text-[#9C8A82] mt-1">Fecha: {formatDate(selectedClient.next_action.date)}</p>
              </div>
            )}

            {selectedClient.notes && (
              <div>
                <h4 className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider mb-1">Notas</h4>
                <p className="text-sm text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3">{selectedClient.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
