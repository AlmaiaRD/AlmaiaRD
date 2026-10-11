"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { normalize } from "@/lib/search";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getClientCardData, updateClientStage, migrateStages, createClient, updateClient } from "@/services/clients";
import { calculateRiskScore } from "@/services/ia";
import type { RiskScore } from "@/services/ia";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  SALES_STAGES, RECRUITMENT_STAGES, QUALIFICATION_OPTIONS, CLOSURE_RESULTS, ENROLLMENT_RESULTS,
  STAGNATION_THRESHOLD_DAYS, type ClientType, getStagesForType,
} from "@/lib/pipeline-constants";
import {
  Search, Phone, Mail, Tag, ShoppingCart, DollarSign, TrendingUp, Users,
  UserPlus, BarChart3, Zap, FileText, CheckCircle2, Handshake, AlertTriangle, MessageSquare, Presentation, Briefcase, HelpCircle,
  ShoppingCart as CartIcon, Briefcase as BriefcaseIcon, UserCheck, User, Edit2,
  LayoutGrid, List as ListIcon, ArrowUpDown,
} from "lucide-react";
import toast from "react-hot-toast";
import type { LucideIcon } from "lucide-react";
import type { ClientCardData } from "@/types/database";

const ICON_MAP: Record<string, LucideIcon> = {
  UserPlus, CheckCircle: CheckCircle2, Phone, FileText, Handshake,
  Presentation, Briefcase, HelpCircle, ShoppingCart: CartIcon,
};

const CLIENT_TYPE_CONFIG = {
  comprador: { label: "Clientes Compradores", icon: CartIcon, color: "text-[#86C7A3]", bg: "bg-[#86C7A3]/10", stages: SALES_STAGES },
  negocio: { label: "Prospectos de Negocio", icon: BriefcaseIcon, color: "text-purple-500", bg: "bg-purple-50", stages: RECRUITMENT_STAGES },
};

function StageBadge({ stage, clientType, qualificationLevel }: { stage: string; clientType: ClientType; qualificationLevel?: string | null }) {
  const stages = getStagesForType(clientType);
  const s = stages.find(x => x.key === stage);
  if (!s) return <Badge variant="neutral">{stage}</Badge>;
  const Icon = ICON_MAP[s.icon] || UserPlus;
  const qual = clientType === "comprador" && qualificationLevel ? QUALIFICATION_OPTIONS.find(q => q.key === qualificationLevel) : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
      <Icon size={12} />
      {s.label}
      {qual && <span className="ml-1 opacity-70">· {qual.label}</span>}
    </span>
  );
}

/**
 * Tarjeta del kanban. Definida a NIVEL DE MÓDULO, no dentro de
 * `PipelinePage`.
 *
 * Un componente declarado dentro del cuerpo de otro se crea como un tipo
 * nuevo en cada render del padre, y React lo trata como otro componente
 * distinto: desmonta el anterior y monta uno desde cero. Aquí eso significa
 * que cada cambio de estado del pipeline (mover una tarjeta, cambiar el
 * filtro, cargar datos) reiniciaba el textarea de notas en medio de la
 * escritura, perdiendo el foco y el texto tecleado. Al sacarlo fuera la
 * identidad del tipo es estable y React conserva el estado.
 *
 * El estado y los callbacks del padre entran por props.
 */
function KanbanCard({
  client,
  draggingId,
  batchMode,
  isSelected,
  onDragStart,
  onToggleSelect,
  onOpen,
  onNotesSaved,
}: {
  client: ClientCardData;
  draggingId: string | null;
  batchMode: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent, clientId: string) => void;
  onToggleSelect: (clientId: string) => void;
  onOpen: (client: ClientCardData) => void;
  onNotesSaved: (clientId: string, notes: string) => void;
}) {
  const isStagnant = client.days_in_stage !== null && client.days_in_stage >= STAGNATION_THRESHOLD_DAYS;
  const ct = client.client_type || "comprador";
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(client.notes || "");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Sincronizar borrador cuando la nota guardada cambia desde fuera.
  // useEffect evita setState durante render (causa hydration mismatch #301).
  useEffect(() => {
    if (!editingNote) setNoteValue(client.notes || "");
  }, [client.notes, editingNote]);

  useEffect(() => {
    if (editingNote && noteRef.current) {
      noteRef.current.focus();
      noteRef.current.setSelectionRange(noteRef.current.value.length, noteRef.current.value.length);
    }
  }, [editingNote]);

  async function saveNote() {
    if (noteValue === (client.notes || "")) { setEditingNote(false); return; }
    try {
      await updateClient(client.id, { notes: noteValue });
      onNotesSaved(client.id, noteValue);
      toast.success("Nota guardada");
    } catch { toast.error("Error al guardar nota"); }
    setEditingNote(false);
  }

  return (
    <div
      className={`bg-white rounded-xl border p-2.5 cursor-pointer hover:shadow-md transition-all ${isStagnant ? "border-[#E8C87A]" : "border-[#E0DAD3]"} ${draggingId === client.id ? "opacity-50" : ""}`}
      draggable={!editingNote}
      onDragStart={e => onDragStart(e, client.id)}
      onClick={() => {
        if (batchMode) { onToggleSelect(client.id); return; }
        if (editingNote) return;
        onOpen(client);
      }}
      title={client.notes ? `Nota: ${client.notes}` : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {batchMode && <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(client.id)} onClick={e => e.stopPropagation()} className="rounded border-[#E0DAD3] text-[#BA4A3A]" />}
          <span className={`w-2 h-2 rounded-full shrink-0 ${ct === "negocio" ? "bg-purple-500" : "bg-[#86C7A3]"}`} />
          <h4 className="text-sm font-semibold text-[#39484F] truncate">{client.full_name}</h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isStagnant && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8C87A]/20 text-[#B8860B] font-medium whitespace-nowrap">⚠ {client.days_in_stage}d</span>}
          <button
            onClick={e => { e.stopPropagation(); setEditingNote(!editingNote); }}
            className="p-1 rounded hover:bg-[#F1E9DF] text-[#4C5760] hover:text-[#BA4A3A] transition-colors"
            title={client.notes ? "Editar nota" : "Agregar nota"}
          >
            <Edit2 size={12} />
          </button>
        </div>
      </div>

      {editingNote ? (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <textarea
            ref={noteRef}
            value={noteValue}
            onChange={e => setNoteValue(e.target.value)}
            onBlur={saveNote}
            onKeyDown={e => {
              if (e.key === "Escape") { setEditingNote(false); setNoteValue(client.notes || ""); }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(); }
            }}
            placeholder="Escribe una nota..."
            rows={3}
            className="w-full px-2 py-1.5 text-xs text-[#39484F] bg-[#F5EFE9] border border-[#BA4A3A]/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#BA4A3A] resize-none"
          />
          <p className="text-[9px] text-[#4C5760] mt-1">Enter para guardar · Esc para cancelar</p>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#4C5760]">
          {ct === "comprador" ? (
            <>
              <span className="flex items-center gap-0.5"><DollarSign size={10} /> {formatCurrency(client.total_spent)}</span>
              <span className="flex items-center gap-0.5"><ShoppingCart size={10} /> {client.num_purchases}x</span>
            </>
          ) : (
            <span className="flex items-center gap-0.5"><Users size={10} /> {formatDate(client.created_at)}</span>
          )}
          {client.pending_balance > 0 && (
            <span className="text-[#D4A0A0] font-medium ml-auto">Pend: {formatCurrency(client.pending_balance)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [clients, setClients] = useState<ClientCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientType | "">("");
  const [selectedClient, setSelectedClient] = useState<ClientCardData | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [approach, setApproach] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", phone: "", email: "", client_type: "comprador" as ClientType, stage: "prospecto" });
  const [saving, setSaving] = useState(false);
  // Vista: lista (tabla, fácil de leer/seguir) por defecto; tablero kanban opcional.
  const [view, setView] = useState<"lista" | "tablero">("lista");
  const [listSort, setListSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "days_in_stage", dir: "desc" });

  useEffect(() => {
    async function load() {
      try {
        const data = await getClientCardData();
        setClients(data);
        const hasOldStages = data.some(c => {
          const stages = getStagesForType(c.client_type || "comprador");
          return !stages.some(s => s.key === c.stage);
        });
        if (hasOldStages) setShowMigrateModal(true);
      } catch {
        toast.error("Error al cargar pipeline");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = clients.filter(c => {
      const stages = getStagesForType(c.client_type || "comprador");
      return stages.some(s => s.key === c.stage);
    });
    if (searchQuery) {
      const q = normalize(searchQuery);
      result = result.filter(c =>
        normalize(c.full_name).includes(q) ||
        (c.phone && normalize(c.phone).includes(q)) ||
        (c.email && normalize(c.email).includes(q))
      );
    }
    if (clientTypeFilter) result = result.filter(c => (c.client_type || "comprador") === clientTypeFilter);
    return result;
  }, [clients, searchQuery, clientTypeFilter]);

  const buyersByStage = useMemo(() => {
    const map: Record<string, ClientCardData[]> = {};
    for (const s of SALES_STAGES) map[s.key] = [];
    for (const c of filtered) {
      if ((c.client_type || "comprador") === "comprador" && map[c.stage]) {
        map[c.stage].push(c);
      }
    }
    return map;
  }, [filtered]);

  const prospectsByStage = useMemo(() => {
    const map: Record<string, ClientCardData[]> = {};
    for (const s of RECRUITMENT_STAGES) map[s.key] = [];
    for (const c of filtered) {
      if ((c.client_type || "comprador") === "negocio" && map[c.stage]) {
        map[c.stage].push(c);
      }
    }
    return map;
  }, [filtered]);

  // Días desde creación hasta cambio de tipo (evita new Date() en render → hydration mismatch #301)
  const daysSinceCreated = useMemo(() => {
    if (!selectedClient?.client_type_changed_at || !selectedClient?.created_at) return 0;
    return Math.floor((new Date(selectedClient.client_type_changed_at).getTime() - new Date(selectedClient.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [selectedClient]);

  // Lista ordenable: una fila por cliente, fácil de leer y seguir.
  const listRows = useMemo(() => {
    const val = (c: ClientCardData): string | number => {
      switch (listSort.key) {
        case "name": return c.full_name;
        case "type": return c.client_type === "negocio" ? "1" : "0";
        case "stage": return getStagesForType(c.client_type || "comprador").findIndex(s => s.key === c.stage);
        case "total": return c.total_spent;
        case "pending": return c.pending_balance;
        case "purchases": return c.num_purchases;
        default: return c.days_in_stage ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a); const bv = val(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return listSort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, listSort]);

  function toggleListSort(key: string) {
    setListSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const handleStageChange = useCallback(async (clientId: string, newStage: string, extra?: { qualification_level?: string; closure_result?: string }) => {
    try {
      await updateClientStage(clientId, newStage, extra);
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, stage: newStage, stage_entered_at: new Date().toISOString(), ...extra } : c));
      toast.success("Etapa actualizada");
    } catch {
      toast.error("Error al actualizar etapa");
    }
  }, []);

  const handleConvertClientType = useCallback(async (clientId: string, newType: ClientType) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const label = newType === "negocio" ? "Prospecto de Negocio" : "Cliente Comprador";
    if (!window.confirm(`¿Convertir a ${client.full_name} como ${label}?`)) return;
    
    try {
      const newStage = newType === "negocio" ? "prospecto" : "lead";
      await updateClient(clientId, {
        client_type: newType,
        stage: newStage,
        stage_entered_at: new Date().toISOString(),
        client_type_changed_at: new Date().toISOString(),
        previous_client_type: client.client_type || "comprador",
      });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, client_type: newType, stage: newStage, stage_entered_at: new Date().toISOString(), client_type_changed_at: new Date().toISOString(), previous_client_type: c.client_type || "comprador" } : c));
      setSelectedClient(null);
      toast.success(`Cliente convertido a ${label}`);
    } catch {
      toast.error("Error al convertir cliente");
    }
  }, [clients]);

  const handleBatchMove = useCallback(async (newStage: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let success = 0;
    for (const id of ids) {
      try { await updateClientStage(id, newStage); success++; } catch { toast.error("Error al mover cliente"); }
    }
    setClients(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, stage: newStage, stage_entered_at: new Date().toISOString() } : c));
    setSelectedIds(new Set());
    setBatchMode(false);
    toast.success(`${success} cliente(s) movido(s)`);
  }, [selectedIds]);

  const handleMigrate = useCallback(async () => {
    setMigrating(true);
    try {
      const count = await migrateStages();
      toast.success(`${count} cliente(s) migrado(s)`);
      const data = await getClientCardData();
      setClients(data);
      setShowMigrateModal(false);
    } catch {
      toast.error("Error en la migración");
    } finally {
      setMigrating(false);
    }
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function handleDragStart(e: React.DragEvent, clientId: string) {
    e.dataTransfer.setData("text/plain", clientId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(clientId);
  }

  /** Abrir el detalle del cliente: antes lo hacía la tarjeta en línea. */
  function openClient(client: ClientCardData) {
    setSelectedClient(client);
    setRiskScore(null);
    setAiSummary("");
    calculateRiskScore(client.id)
      .then(setRiskScore)
      .catch((e) => console.error("Error al calcular riesgo", e));
  }

  /** Reflejar en la lista la nota que acaba de guardar la tarjeta. */
  function handleNotesSaved(clientId: string, notes: string) {
    setClients(prev => prev.map(c => (c.id === clientId ? { ...c, notes } : c)));
  }

  function handleDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageKey);
  }

  function handleDragLeave() { setDragOverStage(null); }

  function handleDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    const clientId = e.dataTransfer.getData("text/plain");
    if (clientId) handleStageChange(clientId, stageKey);
    setDraggingId(null);
    setDragOverStage(null);
  }

  async function handleAddToPipeline() {
    if (!addForm.full_name.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const client = await createClient({
        full_name: addForm.full_name,
        phone: addForm.phone,
        email: addForm.email,
        client_type: addForm.client_type,
        stage: addForm.stage,
        stage_entered_at: new Date().toISOString(),
      });
      setClients(prev => [...prev, {
        ...client,
        pending_balance: 0, total_spent: 0, num_purchases: 0, last_purchase_date: null,
        days_since_last_purchase: null, avg_ticket: 0, pv_total: 0, top_products: [],
        tags: [], next_action: null, repurchase_date: null, days_in_stage: 0,
      }]);
      setShowAddModal(false);
      setAddForm({ full_name: "", phone: "", email: "", client_type: "comprador", stage: "prospecto" });
      toast.success("Agregado al pipeline");
    } catch {
      toast.error("Error al agregar");
    } finally {
      setSaving(false);
    }
  }


  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[30px] font-marca text-[#39484F]">Pipeline Comercial</h1>
          <p className="text-sm text-[#4C5760] mt-1">Arrastra clientes entre etapas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#E0DAD3] overflow-hidden bg-white">
            <button onClick={() => setView("lista")} title="Vista lista" className={`px-3 py-2.5 text-sm font-medium flex items-center gap-1.5 transition-all ${view === "lista" ? "bg-[#BA4A3A] text-white" : "text-[#4C5760] hover:bg-[#F1E9DF]"}`}>
              <ListIcon size={15} /> <span className="hidden sm:inline">Lista</span>
            </button>
            <button onClick={() => setView("tablero")} title="Vista tablero" className={`px-3 py-2.5 text-sm font-medium flex items-center gap-1.5 transition-all ${view === "tablero" ? "bg-[#BA4A3A] text-white" : "text-[#4C5760] hover:bg-[#F1E9DF]"}`}>
              <LayoutGrid size={15} /> <span className="hidden sm:inline">Tablero</span>
            </button>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-[#BA4A3A] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9C382A] transition-all shadow-sm">
            <UserPlus size={16} /> <span className="hidden sm:inline">Agregar al Pipeline</span><span className="sm:hidden">Agregar</span>
          </button>
          {batchMode && selectedIds.size > 0 && (
            <select onChange={e => { if (e.target.value) handleBatchMove(e.target.value); e.target.value = ""; }} className="h-10 px-3 rounded-lg border border-[#E0DAD3] bg-white text-xs text-[#39484F]" defaultValue="">
              <option value="" disabled>Mover a...</option>
              {SALES_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
          <button onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }} className={`px-3 py-2 rounded-lg border text-xs font-medium ${batchMode ? "border-[#BA4A3A] bg-[#BA4A3A]/10 text-[#BA4A3A]" : "border-[#E0DAD3] text-[#4C5760] hover:text-[#39484F]"}`}>
            {batchMode ? "Cancelar" : "Seleccionar"}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4C5760]" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar cliente..." className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E0DAD3] bg-white text-[#39484F] placeholder-[#4C5760] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30 focus:border-[#BA4A3A] transition-all" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["", "comprador", "negocio"] as const).map(type => {
            const config = type ? CLIENT_TYPE_CONFIG[type] : null;
            const Icon = config?.icon || Users;
            return (
              <button key={type} onClick={() => setClientTypeFilter(type)}
                className={`h-10 sm:h-12 px-3 sm:px-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all ${clientTypeFilter === type ? "bg-[#BA4A3A] text-white border-[#BA4A3A]" : "border-[#E0DAD3] bg-white text-[#39484F] hover:bg-[#F1E9DF]"}`}>
                <Icon size={14} /> {type === "" ? "Todos" : config!.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" /></div>
      ) : view === "lista" ? (
        /* ── Vista Lista: una fila por cliente, ordenable ─────────────── */
        <div className="bg-white rounded-2xl border border-[#E0DAD3] shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-[#E0DAD3] bg-[#F5EFE9] text-xs font-semibold uppercase tracking-wider text-[#4C5760]">
                {[
                  { key: "name", label: "Cliente" },
                  { key: "type", label: "Tipo" },
                  { key: "stage", label: "Etapa" },
                  { key: "days_in_stage", label: "Días en etapa" },
                  { key: "total", label: "Total gastado" },
                  { key: "purchases", label: "Compras" },
                  { key: "pending", label: "Pendiente" },
                ].map(col => (
                  <th key={col.key} className="text-left px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:text-[#39484F]" onClick={() => toggleListSort(col.key)}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown size={11} className={listSort.key === col.key ? "text-[#BA4A3A]" : "opacity-40"} />
                    </span>
                  </th>
                ))}
                <th className="text-left px-4 py-3">Etapa (cambio rápido)</th>
              </tr>
            </thead>
            <tbody>
              {listRows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-[#4C5760]">Sin clientes que coincidan</td></tr>
              )}
              {listRows.map(c => {
                const stagnant = c.days_in_stage !== null && c.days_in_stage >= STAGNATION_THRESHOLD_DAYS;
                return (
                  <tr key={c.id} className="border-b border-[#F0EBE3] hover:bg-[#F1E9DF] cursor-pointer transition-colors" onClick={() => openClient(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${(c.client_type || "comprador") === "negocio" ? "bg-purple-500" : "bg-[#86C7A3]"}`} />
                        <span className="font-medium text-[#39484F] truncate max-w-[220px]" title={c.full_name}>{c.full_name}</span>
                        {c.notes && <span title={`Nota: ${c.notes}`} className="text-[10px] text-[#A99B90]">📝</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4C5760] whitespace-nowrap">{(c.client_type || "comprador") === "negocio" ? "Negocio" : "Comprador"}</td>
                    <td className="px-4 py-3"><StageBadge stage={c.stage} clientType={c.client_type || "comprador"} qualificationLevel={c.qualification_level} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${stagnant ? "text-[#B8860B] bg-[#E8C87A]/20 px-2 py-0.5 rounded-lg" : "text-[#4C5760]"}`}>
                        {c.days_in_stage ?? "—"}{stagnant ? " ⚠" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#39484F] whitespace-nowrap">{formatCurrency(c.total_spent)}</td>
                    <td className="px-4 py-3 text-[#4C5760]">{c.num_purchases}x</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.pending_balance > 0 ? <span className="text-[#D4A0A0] font-semibold">{formatCurrency(c.pending_balance)}</span> : <span className="text-[#E0DAD3]">—</span>}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={c.stage}
                        onChange={e => handleStageChange(c.id, e.target.value)}
                        className="h-9 px-2 rounded-lg border border-[#E0DAD3] bg-white text-xs text-[#39484F] focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30 max-w-[180px]"
                      >
                        {getStagesForType(c.client_type || "comprador").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Buyers Kanban */}
          {clientTypeFilter !== "negocio" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CartIcon size={18} className="text-[#86C7A3]" />
                <h2 className="text-sm font-semibold text-[#39484F]">Clientes Compradores</h2>
                <span className="text-xs text-[#4C5760]">({Object.values(buyersByStage).flat().length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {SALES_STAGES.map(stage => {
                  const stageClients = buyersByStage[stage.key] || [];
                  const Icon = ICON_MAP[stage.icon] || UserPlus;
                  const isDragOver = dragOverStage === stage.key;
                  
                  return (
                    <div
                      key={stage.key}
                      className={`bg-[#F1E9DF] rounded-xl p-3 min-h-[200px] transition-colors ${isDragOver ? "ring-2 ring-[#BA4A3A] bg-[#BA4A3A]/5" : ""}`}
                      onDragOver={e => handleDragOver(e, stage.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, stage.key)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${stage.bg}`}><Icon size={14} className={stage.color} /></div>
                          <span className="text-xs font-semibold text-[#39484F]">{stage.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stageClients.length}</span>
                      </div>
                      <div className="space-y-2">
                        {stageClients.map(client => (
                          <KanbanCard
                            key={client.id}
                            client={client}
                            draggingId={draggingId}
                            batchMode={batchMode}
                            isSelected={selectedIds.has(client.id)}
                            onDragStart={handleDragStart}
                            onToggleSelect={toggleSelect}
                            onOpen={openClient}
                            onNotesSaved={handleNotesSaved}
                          />
                        ))}
                        {stageClients.length === 0 && (
                          <div className="text-center py-8 text-[10px] text-[#4C5760]">Sin clientes</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prospects Kanban */}
          {clientTypeFilter !== "comprador" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BriefcaseIcon size={18} className="text-purple-500" />
                <h2 className="text-sm font-semibold text-[#39484F]">Prospectos de Negocio</h2>
                <span className="text-xs text-[#4C5760]">({Object.values(prospectsByStage).flat().length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {RECRUITMENT_STAGES.map(stage => {
                  const stageClients = prospectsByStage[stage.key] || [];
                  const Icon = ICON_MAP[stage.icon] || UserPlus;
                  const isDragOver = dragOverStage === stage.key;
                  
                  return (
                    <div
                      key={stage.key}
                      className={`bg-[#F1E9DF] rounded-xl p-3 min-h-[200px] transition-colors ${isDragOver ? "ring-2 ring-purple-500 bg-purple-50/50" : ""}`}
                      onDragOver={e => handleDragOver(e, stage.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, stage.key)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${stage.bg}`}><Icon size={14} className={stage.color} /></div>
                          <span className="text-xs font-semibold text-[#39484F]">{stage.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stageClients.length}</span>
                      </div>
                      <div className="space-y-2">
                        {stageClients.map(client => (
                          <KanbanCard
                            key={client.id}
                            client={client}
                            draggingId={draggingId}
                            batchMode={batchMode}
                            isSelected={selectedIds.has(client.id)}
                            onDragStart={handleDragStart}
                            onToggleSelect={toggleSelect}
                            onOpen={openClient}
                            onNotesSaved={handleNotesSaved}
                          />
                        ))}
                        {stageClients.length === 0 && (
                          <div className="text-center py-8 text-[10px] text-[#4C5760]">Sin clientes</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedClient} onClose={() => { setSelectedClient(null); setRiskScore(null); setAiSummary(""); setApproach(""); }} title={selectedClient?.full_name || "Detalle"} wide>
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <StageBadge stage={selectedClient.stage} clientType={selectedClient.client_type || "comprador"} qualificationLevel={selectedClient.qualification_level} />
                {selectedClient.tags.map(t => (
                  <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-[#BA4A3A]/10 text-[#BA4A3A] font-medium">{t.name}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(selectedClient.client_type || "comprador") === "comprador" ? (
                  <button onClick={() => handleConvertClientType(selectedClient.id, "negocio")} className="flex items-center gap-1.5 text-xs text-purple-500 hover:underline px-2 py-1 rounded-lg hover:bg-purple-50">
                    <Briefcase size={12} /> <span className="hidden sm:inline">Convertir a Prospecto</span><span className="sm:hidden">Prospecto</span>
                  </button>
                ) : (
                  <button onClick={() => handleConvertClientType(selectedClient.id, "comprador")} className="flex items-center gap-1.5 text-xs text-[#86C7A3] hover:underline px-2 py-1 rounded-lg hover:bg-[#86C7A3]/10">
                    <User size={12} /> <span className="hidden sm:inline">Convertir a Comprador</span><span className="sm:hidden">Comprador</span>
                  </button>
                )}
                <select value={selectedClient.stage} onChange={e => handleStageChange(selectedClient.id, e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[#E0DAD3] bg-white text-xs text-[#39484F] focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30">
                  {getStagesForType(selectedClient.client_type || "comprador").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {selectedClient.previous_client_type && selectedClient.client_type_changed_at && (
              <div className="bg-[#F1E9DF] rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#BA4A3A]/10 flex items-center justify-center">
                  <Briefcase size={14} className="text-[#BA4A3A]" />
                </div>
                <div>
                  <p className="text-xs text-[#4C5760]">
                    Fue {selectedClient.previous_client_type === "comprador" ? "Cliente Comprador" : "Prospecto de Negocio"} por{" "}
                    {daysSinceCreated} días
                  </p>
                  <p className="text-xs text-[#4C5760]">
                    Convertido el {formatDate(selectedClient.client_type_changed_at)}
                  </p>
                </div>
              </div>
            )}

            {selectedClient.stage === "calificacion" && selectedClient.client_type === "comprador" && (
              <div className="bg-[#F1E9DF] rounded-xl p-4">
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-2">Nivel de calificación</h4>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATION_OPTIONS.map(q => (
                    <button key={q.key} onClick={() => handleStageChange(selectedClient.id, "calificacion", { qualification_level: q.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedClient.qualification_level === q.key ? `${q.bg} ${q.color} ring-2 ring-offset-1 ring-current` : "bg-white text-[#4C5760] border border-[#E0DAD3] hover:bg-[#F1E9DF]"}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedClient.stage === "cierre" && (
              <div className="bg-[#F1E9DF] rounded-xl p-4">
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-2">Resultado del cierre</h4>
                <div className="flex flex-wrap gap-2">
                  {CLOSURE_RESULTS.map(cr => (
                    <button key={cr.key} onClick={() => handleStageChange(selectedClient.id, "cierre", { closure_result: cr.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedClient.closure_result === cr.key ? `${cr.bg} ${cr.color} ring-2 ring-offset-1 ring-current` : "bg-white text-[#4C5760] border border-[#E0DAD3] hover:bg-[#F1E9DF]"}`}>
                      {cr.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedClient.stage === "inscripcion" && (
              <div className="bg-[#F1E9DF] rounded-xl p-4">
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-2">Resultado de inscripción</h4>
                <div className="flex flex-wrap gap-2">
                  {ENROLLMENT_RESULTS.map(er => (
                    <button key={er.key} onClick={() => handleStageChange(selectedClient.id, "inscripcion", { closure_result: er.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedClient.closure_result === er.key ? `${er.bg} ${er.color} ring-2 ring-offset-1 ring-current` : "bg-white text-[#4C5760] border border-[#E0DAD3] hover:bg-[#F1E9DF]"}`}>
                      {er.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedClient.days_in_stage !== null && selectedClient.days_in_stage >= STAGNATION_THRESHOLD_DAYS && (
              <div className="bg-[#FFFBEB] border border-[#E8C87A]/30 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-[#E8C87A]" />
                <div>
                  <p className="text-sm font-semibold text-[#B8860B]">Cliente estancado</p>
                  <p className="text-xs text-[#4C5760]">Lleva {selectedClient.days_in_stage} días en esta etapa sin movimiento</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider">Contacto</h4>
                {selectedClient.phone && (
                  <p className="text-sm text-[#39484F] flex items-center gap-2">
                    <Phone size={14} className="text-[#4C5760]" /> {selectedClient.phone}
                    <a href={`https://wa.me/1${selectedClient.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#86C7A3] hover:underline text-xs"><MessageSquare size={12} /> WhatsApp</a>
                  </p>
                )}
                {selectedClient.email && <p className="text-sm text-[#39484F] flex items-center gap-2"><Mail size={14} className="text-[#4C5760]" /> {selectedClient.email}</p>}
                {selectedClient.lead_source && <p className="text-sm text-[#39484F] flex items-center gap-2"><UserPlus size={14} className="text-[#4C5760]" /> Llegó por: {selectedClient.lead_source}</p>}
                {selectedClient.interest && <p className="text-sm text-[#39484F] flex items-center gap-2"><Tag size={14} className="text-[#4C5760]" /> Interés: {selectedClient.interest}</p>}
                {selectedClient.ibo_number && <p className="text-sm text-[#39484F] flex items-center gap-2"><UserCheck size={14} className="text-[#4C5760]" /> IBO: {selectedClient.ibo_number}</p>}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider">Comercial</h4>
                <p className="text-sm text-[#39484F] flex items-center gap-2"><DollarSign size={14} className="text-[#4C5760]" /> Total gastado: <strong>{formatCurrency(selectedClient.total_spent)}</strong></p>
                <p className="text-sm text-[#39484F] flex items-center gap-2"><ShoppingCart size={14} className="text-[#4C5760]" /> Compras: <strong>{selectedClient.num_purchases}</strong></p>
                <p className="text-sm text-[#39484F] flex items-center gap-2"><BarChart3 size={14} className="text-[#4C5760]" /> PV total: <strong>{selectedClient.pv_total.toFixed(2)}</strong></p>
                <p className="text-sm text-[#39484F] flex items-center gap-2"><TrendingUp size={14} className="text-[#4C5760]" /> Ticket promedio: <strong>{formatCurrency(selectedClient.avg_ticket)}</strong></p>
                {selectedClient.repurchase_date && (
                  <p className="text-sm text-[#39484F] flex items-center gap-2"><Zap size={14} className="text-[#86C7A3]" /> Recompra: <strong>{formatDate(selectedClient.repurchase_date)}</strong></p>
                )}
              </div>
            </div>

            {selectedClient.pending_balance > 0 && (
              <div className="bg-[#FFF5F5] border border-[#D4A0A0]/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#D4A0A0] flex items-center gap-2"><DollarSign size={16} /> Saldo pendiente: {formatCurrency(selectedClient.pending_balance)}</p>
              </div>
            )}

            {selectedClient.top_products.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-2">Productos favoritos</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedClient.top_products.map((p, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-[#F1E9DF] text-[#39484F] border border-[#E0DAD3]">{p.name} ({p.count}x)</span>
                  ))}
                </div>
              </div>
            )}

            {riskScore && (
              <div className={`rounded-xl p-4 border ${riskScore.level === "high" ? "bg-[#FFF5F5] border-[#D4A0A0]/30" : riskScore.level === "medium" ? "bg-[#FFFBEB] border-[#E8C87A]/30" : "bg-[#F0FAF4] border-[#86C7A3]/30"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider">Análisis de Riesgo</h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskScore.level === "high" ? "bg-[#D4A0A0]/20 text-[#D4A0A0]" : riskScore.level === "medium" ? "bg-[#E8C87A]/20 text-[#B8860B]" : "bg-[#86C7A3]/20 text-[#6DB08A]"}`}>
                    {riskScore.level === "high" ? "Alto" : riskScore.level === "medium" ? "Medio" : "Bajo"}
                  </span>
                </div>
                <div className="space-y-1">
                  {riskScore.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-[#39484F]">
                      <span>{f.label}</span>
                      <span className={`font-medium ${f.impact > 30 ? "text-[#D4A0A0]" : f.impact > 10 ? "text-[#E8C87A]" : "text-[#86C7A3]"}`}>+{f.impact}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button onClick={async () => {
                setLoadingSummary(true);
                try {
                  const res = await fetch("/api/client-summary", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: selectedClient.id, client: { full_name: selectedClient.full_name, stage: selectedClient.stage, email: selectedClient.email, phone: selectedClient.phone, created_at: selectedClient.created_at, notes: selectedClient.notes },
                      stats: { total_spent: selectedClient.total_spent, total_paid: selectedClient.total_spent - selectedClient.pending_balance, pending_count: selectedClient.pending_balance > 0 ? 1 : 0, avg_ticket: selectedClient.avg_ticket, num_purchases: selectedClient.num_purchases, top_products: selectedClient.top_products.map(p => `${p.name} x${p.count}`).join(", ") } }),
                  });
                  if (!res.ok) throw new Error();
                  const data = await res.json();
                  setAiSummary(data.ai_summary || "No disponible");
                  setApproach(data.approach || "");
                } catch { setAiSummary("Error al generar resumen"); setApproach(""); }
                finally { setLoadingSummary(false); }
              }} disabled={loadingSummary} className="w-full h-10 bg-[#BA4A3A]/10 text-[#BA4A3A] rounded-xl text-sm font-medium hover:bg-[#BA4A3A]/20 transition-all disabled:opacity-50">
                {loadingSummary ? "Generando resumen con IA..." : "Generar Resumen con IA"}
              </button>
              {aiSummary && (
                <div className="mt-3 space-y-3">
                  <div className="bg-[#F1E9DF] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-2">Resumen IA</h4>
                    <p className="text-sm text-[#39484F] leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                  {approach && (
                    <div className="bg-[#BA4A3A]/5 border border-[#BA4A3A]/20 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-[#BA4A3A] uppercase tracking-wider mb-2">Sugerencia de Abordaje</h4>
                      <p className="text-sm text-[#39484F] leading-relaxed">{approach}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedClient.notes && (
              <div>
                <h4 className="text-xs font-semibold text-[#4C5760] uppercase tracking-wider mb-1">Notas</h4>
                <p className="text-sm text-[#39484F] bg-[#F1E9DF] rounded-xl p-3">{selectedClient.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Migrate Modal */}
      <Modal isOpen={showMigrateModal} onClose={() => setShowMigrateModal(false)} title="Migrar etapas del pipeline">
        <div className="space-y-4">
          <p className="text-sm text-[#39484F]">Se detectaron clientes con etapas del sistema anterior. Se migrarán automáticamente:</p>
          <div className="bg-[#F1E9DF] rounded-xl p-4 space-y-2 text-sm">
            <p><strong>Lead</strong> → Prospecto</p>
            <p><strong>Contactado</strong> → Calificación</p>
            <p><strong>Cotización</strong> → Propuesta</p>
            <p><strong>1ra Compra / Postventa / Activo / Recompra / VIP</strong> → Cierre</p>
          </div>
          <p className="text-xs text-[#4C5760]">Los clientes se marcarán como &quot;comprador&quot; por defecto.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowMigrateModal(false)} className="flex-1 h-12 border border-[#E0DAD3] text-[#39484F] rounded-xl text-sm font-medium hover:bg-[#F1E9DF]">Cancelar</button>
            <button onClick={handleMigrate} disabled={migrating} className="flex-1 h-12 bg-[#BA4A3A] text-white rounded-xl text-sm font-medium hover:bg-[#9C382A] disabled:opacity-50">{migrating ? "Migrando..." : "Migrar ahora"}</button>
          </div>
        </div>
      </Modal>

      {/* Add to Pipeline Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar al Pipeline">
        <div className="space-y-4">
          <div className="flex gap-3">
            {([["comprador", "Cliente Comprador", CartIcon], ["negocio", "Prospecto de Negocio", BriefcaseIcon]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => {
                const stages = getStagesForType(value);
                setAddForm({ ...addForm, client_type: value, stage: stages[0].key });
              }}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${addForm.client_type === value ? "border-[#BA4A3A] bg-[#BA4A3A]/5 text-[#39484F]" : "border-[#E0DAD3] text-[#4C5760] hover:bg-[#F1E9DF]"}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#39484F] mb-1.5">Etapa inicial</label>
            <select value={addForm.stage} onChange={e => setAddForm({ ...addForm, stage: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-[#E0DAD3] bg-white text-[#39484F] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30">
              {getStagesForType(addForm.client_type).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#39484F] mb-1.5">Nombre *</label>
            <input type="text" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="Nombre y apellidos" className="w-full h-12 px-4 rounded-xl border border-[#E0DAD3] bg-[#F5EFE9] text-[#39484F] placeholder-[#4C5760] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#39484F] mb-1.5">Teléfono</label>
              <input type="text" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="809-000-0000" className="w-full h-12 px-4 rounded-xl border border-[#E0DAD3] bg-[#F5EFE9] text-[#39484F] placeholder-[#4C5760] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#39484F] mb-1.5">Email</label>
              <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="correo@ejemplo.com" className="w-full h-12 px-4 rounded-xl border border-[#E0DAD3] bg-[#F5EFE9] text-[#39484F] placeholder-[#4C5760] text-sm focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)} className="flex-1 h-12 border border-[#E0DAD3] text-[#39484F] rounded-xl text-sm font-medium hover:bg-[#F1E9DF]">Cancelar</button>
            <button onClick={handleAddToPipeline} disabled={saving} className="flex-1 h-12 bg-[#BA4A3A] text-white rounded-xl text-sm font-medium hover:bg-[#9C382A] disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus size={16} /> {saving ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
