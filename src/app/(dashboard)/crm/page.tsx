"use client";

import { useState, useEffect, useMemo } from "react";
import { normalize } from "@/lib/search";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { getAllFollowups, createFollowup, updateFollowup, updateFollowupStatus, deleteFollowup } from "@/services/followups";
import { getClients, getClientCardData } from "@/services/clients";
import {
  Search, Plus, MessageSquare, Users,
  MoreVertical, Trash2, Edit3, ChevronLeft, ChevronRight,
  Phone, MapPin, BookOpen, CalendarCheck, ShoppingCart, PartyPopper,
  AlertTriangle, Package, GraduationCap, Clock,
  Wallet, MessageCircle, ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, getLocalDateString } from "@/lib/utils";
import { useRouter } from "next/navigation";

type FollowupWithClient = Awaited<ReturnType<typeof getAllFollowups>>[number];
type FilterStatus = "ALL" | "PENDING" | "COMPLETED" | "OVERDUE";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ACTIVITY_TYPE_ICONS: Record<string, typeof Phone> = {
  "Llamada de seguimiento": Phone,
  "Visita presencial": MapPin,
  "Envío de catálogo": BookOpen,
  "Reunión de negocio": Users,
  "Seguimiento post-venta": ShoppingCart,
  "Invitación a evento": PartyPopper,
  "Reclamación o queja": AlertTriangle,
  "Entrega de producto": Package,
  "Capacitación": GraduationCap,
  "Recordatorio de pago": Clock,
};

function getActivityType(comments: string): string {
  const match = comments?.match(/^\[(.+?)\]/);
  return match ? match[1] : "";
}

function getActivityIcon(comments: string) {
  const type = getActivityType(comments);
  return ACTIVITY_TYPE_ICONS[type] || MessageSquare;
}

function getActivityColor(comments: string): string {
  const type = getActivityType(comments);
  const colors: Record<string, string> = {
    "Llamada de seguimiento": "bg-blue-500",
    "Visita presencial": "bg-green-500",
    "Envío de catálogo": "bg-purple-500",
    "Reunión de negocio": "bg-indigo-500",
    "Seguimiento post-venta": "bg-orange-500",
    "Invitación a evento": "bg-pink-500",
    "Reclamación o queja": "bg-red-500",
    "Entrega de producto": "bg-teal-500",
    "Capacitación": "bg-cyan-500",
    "Recordatorio de pago": "bg-amber-500",
  };
  return colors[type] || "bg-[#B8837E]";
}

export default function CrmPage() {
  const router = useRouter();
  const [followups, setFollowups] = useState<FollowupWithClient[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [repurchaseMap, setRepurchaseMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<FollowupWithClient | null>(null);
  const [showDelete, setShowDelete] = useState<FollowupWithClient | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const ACTIVITY_TYPES = [
    "Llamada de seguimiento",
    "Visita presencial",
    "Envío de catálogo",
    "Reunión de negocio",
    "Seguimiento post-venta",
    "Invitación a evento",
    "Reclamación o queja",
    "Entrega de producto",
    "Capacitación",
    "Recordatorio de pago",
  ];

  const [createForm, setCreateForm] = useState({
    client_id: "",
    contact_date: getLocalDateString(),
    next_followup: "",
    activity_type: "",
    comments: "",
    status: "PENDING" as "PENDING" | "COMPLETED",
  });

  const [editForm, setEditForm] = useState({
    contact_date: "",
    next_followup: "",
    activity_type: "",
    comments: "",
    status: "PENDING" as "PENDING" | "COMPLETED" | "OVERDUE",
  });

  async function loadData() {
    setLoading(true);
    try {
      const [fol, cli, cardData] = await Promise.all([getAllFollowups(), getClients(), getClientCardData()]);
      setFollowups(fol);
      setClients(cli.map((c) => ({ id: c.id, full_name: c.full_name })));
      const map: Record<string, string> = {};
      for (const c of cardData) {
        if (c.repurchase_date) map[c.id] = c.repurchase_date;
      }
      setRepurchaseMap(map);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const pending = followups.filter((f) => f.status === "PENDING").length;
  const completed = followups.filter((f) => f.status === "COMPLETED").length;
  const overdue = followups.filter((f) => f.status === "OVERDUE").length;

  const filtered = useMemo(() => {
    return followups
      .filter((f) => {
        if (filterStatus !== "ALL" && f.status !== filterStatus) return false;
        const q = normalize(searchQuery);
        if (!q) return true;
        const name = normalize(f.clients?.full_name || "");
        const comments = normalize(f.comments || "");
        return name.includes(q) || comments.includes(q);
      })
      .sort((a, b) => new Date(b.contact_date).getTime() - new Date(a.contact_date).getTime());
  }, [followups, filterStatus, searchQuery]);

  const dayActivities = useMemo(() => {
    return selectedDate ? followups.filter((f) => f.contact_date === selectedDate) : [];
  }, [followups, selectedDate]);

  const repurchaseDates = useMemo(() => {
    return new Set(Object.values(repurchaseMap));
  }, [repurchaseMap]);

  function todayStr() {
    return getLocalDateString();
  }

  const calendarDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days: { date: string; day: number; pending: number; total: number; isToday: boolean }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayFol = followups.filter((f) => f.contact_date === dateStr);
      days.push({
        date: dateStr,
        day: d,
        pending: dayFol.filter((f) => f.status !== "COMPLETED").length,
        total: dayFol.length,
        isToday: dateStr === todayStr(),
      });
    }

    return { firstEmpty: first, days };
  }, [calYear, calMonth, followups]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
    setSelectedDate(null);
  }

  function goToday() {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setSelectedDate(todayStr());
  }

  async function handleCreate() {
    if (!createForm.client_id) { toast.error("Selecciona un cliente"); return; }
    if (!createForm.comments.trim()) { toast.error("Escribe un comentario"); return; }
    setSaving(true);
    try {
      const commentsText = createForm.activity_type
        ? `[${createForm.activity_type}] ${createForm.comments.trim()}`
        : createForm.comments.trim();
      await createFollowup({
        client_id: createForm.client_id,
        contact_date: createForm.contact_date,
        next_followup: createForm.next_followup || undefined,
        comments: commentsText,
        status: createForm.status,
      });
      toast.success("Actividad registrada");
      setShowCreate(false);
      setCreateForm({
        client_id: "", contact_date: todayStr(), next_followup: "", activity_type: "", comments: "", status: "PENDING",
      });
      await loadData();
    } catch {
      toast.error("Error al registrar actividad");
    } finally { setSaving(false); }
  }

  function openEdit(f: FollowupWithClient) {
    const comments = f.comments || "";
    const typeMatch = comments.match(/^\[(.+?)\]\s*/);
    setEditForm({
      contact_date: f.contact_date,
      next_followup: f.next_followup || "",
      activity_type: typeMatch ? typeMatch[1] : "",
      comments: typeMatch ? comments.slice(typeMatch[0].length) : comments,
      status: f.status,
    });
    setShowEdit(f);
    setMenuOpen(null);
  }

  async function handleEdit() {
    if (!showEdit) return;
    if (!editForm.comments.trim()) { toast.error("Escribe un comentario"); return; }
    setSaving(true);
    try {
      const commentsText = editForm.activity_type
        ? `[${editForm.activity_type}] ${editForm.comments.trim()}`
        : editForm.comments.trim();
      await updateFollowup(showEdit.id, {
        contact_date: editForm.contact_date,
        next_followup: editForm.next_followup || undefined,
        comments: commentsText,
        status: editForm.status,
      });
      toast.success("Actividad actualizada");
      setShowEdit(null);
      await loadData();
    } catch {
      toast.error("Error al actualizar actividad");
    } finally { setSaving(false); }
  }

  async function handleToggleStatus(f: FollowupWithClient) {
    const next = f.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await updateFollowupStatus(f.id, next);
      await loadData();
    } catch {
      toast.error("Error al cambiar estado");
    }
  }

  async function handleDelete() {
    if (!showDelete) return;
    setSaving(true);
    try {
      await deleteFollowup(showDelete.id);
      toast.success("Actividad eliminada");
      setShowDelete(null);
      await loadData();
    } catch {
      toast.error("Error al eliminar actividad");
    } finally { setSaving(false); }
  }

  function StatusBadge({ status }: { status: string }) {
    switch (status) {
      case "COMPLETED": return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">Completada</span>;
      case "OVERDUE": return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">Vencida</span>;
      default: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>;
    }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">CRM y Seguimiento</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Calendario de actividades comerciales</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
        >
          <Plus size={18} /> Nueva Actividad
        </button>
      </div>

      {/* Sub-modules */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => router.push("/creditos")}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-[#E8E0D8] hover:shadow-md hover:border-[#B8837E]/30 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
            <Wallet size={22} className="text-cyan-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#5C3E35]">Créditos</p>
            <p className="text-xs text-[#9C8A82]">Saldos a favor de clientes</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/whatsapp")}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-[#E8E0D8] hover:shadow-md hover:border-[#B8837E]/30 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
            <MessageCircle size={22} className="text-[#25D366]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#5C3E35]">WhatsApp Business</p>
            <p className="text-xs text-[#9C8A82]">Enviar mensajes y facturas</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-2xl font-bold text-[#5C3E35]">{followups.length}</p>
          <p className="text-xs text-[#9C8A82] mt-1">Total actividades</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-2xl font-bold text-yellow-600">{pending}</p>
          <p className="text-xs text-[#9C8A82] mt-1">Pendientes</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-[#9C8A82] mt-1">Completadas</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-2xl font-bold text-red-600">{overdue}</p>
          <p className="text-xs text-[#9C8A82] mt-1">Vencidas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#FAF6F0] text-[#9C8A82] transition-all">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-base font-semibold text-[#5C3E35] min-w-[160px] text-center">
                  {MONTHS[calMonth]} {calYear}
                </h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#FAF6F0] text-[#9C8A82] transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
              <button
                onClick={goToday}
                className="px-3 py-1.5 rounded-lg border border-[#E8E0D8] text-xs text-[#5C3E35] hover:bg-[#FAF6F0] transition-all"
              >
                Hoy
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-[#9C8A82] py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: calendarDays.firstEmpty }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarDays.days.map((d) => {
                const isSelected = selectedDate === d.date;
                const dayFollowups = followups.filter((f) => f.contact_date === d.date);
                const activityIcons = dayFollowups.slice(0, 3).map((f) => ({
                  Icon: getActivityIcon(f.comments),
                  color: getActivityColor(f.comments),
                }));
                return (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date === selectedDate ? null : d.date)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all ${
                      isSelected
                        ? "bg-[#B8837E] text-white shadow-sm"
                        : d.isToday
                          ? "bg-[#B8837E]/10 text-[#5C3E35] font-semibold"
                          : "text-[#5C3E35] hover:bg-[#FAF6F0]"
                    }`}
                  >
                    <span>{d.day}</span>
                    {(activityIcons.length > 0 || repurchaseDates.has(d.date)) && (
                      <div className="absolute -bottom-0.5 flex gap-0.5">
                        {repurchaseDates.has(d.date) && (
                          <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-white/80" : "bg-[#86C7A3]"}`} title="Recompra estimada" />
                        )}
                        {activityIcons.map((a, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${isSelected ? "bg-white/80" : a.color}`} title={getActivityType(dayFollowups[i]?.comments || "")} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedDate && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#5C3E35]">
                  Actividades del {formatDate(selectedDate)}
                </h3>
                <span className="text-xs text-[#9C8A82]">{dayActivities.length} actividad(es)</span>
              </div>
              {(() => {
                const dayRepurchases = Object.entries(repurchaseMap).filter(([, date]) => date === selectedDate);
                if (dayRepurchases.length === 0) return null;
                return (
                  <div className="mb-3 p-3 bg-[#86C7A3]/10 border border-[#86C7A3]/30 rounded-xl space-y-1.5">
                    <p className="text-xs font-semibold text-[#86C7A3]">⚡ Recompra estimada</p>
                    {dayRepurchases.map(([clientId]) => {
                      const name = clients.find(c => c.id === clientId)?.full_name || "Cliente";
                      return (
                        <button
                          key={clientId}
                          onClick={() => router.push(`/pipeline`)}
                          className="w-full text-left text-xs text-[#86C7A3]/80 hover:text-[#86C7A3] hover:underline flex items-center gap-1"
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              {dayActivities.length === 0 ? (
                <p className="text-center py-6 text-sm text-[#9C8A82]">No hay actividades en esta fecha</p>
              ) : (
                <div className="space-y-2">
                  {dayActivities.map((f) => {
                    const ActivityIcon = getActivityIcon(f.comments);
                    const activityColor = getActivityColor(f.comments);
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0] hover:bg-[#F5F0EB] transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full ${activityColor} flex items-center justify-center flex-shrink-0`}>
                            <ActivityIcon size={14} className="text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#5C3E35] truncate">{f.clients?.full_name}</p>
                            {f.client_id && repurchaseMap[f.client_id] && (
                              <p className="text-[10px] text-[#86C7A3] font-medium">⚡ Recompra: {formatDate(repurchaseMap[f.client_id])}</p>
                            )}
                            <p className="text-xs text-[#9C8A82] truncate">{f.comments}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <StatusBadge status={f.status} />
                          <button
                            onClick={() => handleToggleStatus(f)}
                            className={`p-1.5 rounded-lg transition-all ${
                              f.status === "COMPLETED"
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                            }`}
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#5C3E35]">Todas las actividades</h3>
              <span className="text-xs text-[#9C8A82]">{filtered.length} registros</span>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-xs focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              />
            </div>

            <div className="flex gap-1 mb-4 flex-wrap">
              {(["ALL", "PENDING", "COMPLETED", "OVERDUE"] as FilterStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterStatus === s ? "bg-[#B8837E]/10 text-[#B8837E]" : "text-[#9C8A82] hover:text-[#5C3E35]"
                  }`}
                >
                  {s === "ALL" ? "Todas" : s === "PENDING" ? "Pendientes" : s === "COMPLETED" ? "Completadas" : "Vencidas"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-10 text-[#9C8A82] text-xs">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-[#9C8A82]">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin resultados</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filtered.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-all relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-semibold text-[#5C3E35] truncate">{f.clients?.full_name || "—"}</p>
                          <StatusBadge status={f.status} />
                          {f.client_id && repurchaseMap[f.client_id] && (
                            <span className="text-[10px] text-[#86C7A3] font-medium">⚡ {formatDate(repurchaseMap[f.client_id])}</span>
                          )}
                        </div>
                        <p className="text-xs text-[#5C3E35] mt-1 leading-relaxed line-clamp-2">{f.comments}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#9C8A82]">
                          <span>{formatDate(f.contact_date)}</span>
                          {f.next_followup && <span>→ {formatDate(f.next_followup)}</span>}
                        </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setMenuOpen(menuOpen === f.id ? null : f.id)}
                          className="p-1 rounded-lg hover:bg-[#F5F0EB] text-[#9C8A82]"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {menuOpen === f.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-1 z-20 min-w-[130px]">
                              <button
                                onClick={() => { openEdit(f); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#5C3E35] hover:bg-[#FAF6F0]"
                              >
                                <Edit3 size={12} /> Editar
                              </button>
                              <button
                                onClick={() => { handleToggleStatus(f); setMenuOpen(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#5C3E35] hover:bg-[#FAF6F0]"
                              >
                                <MessageSquare size={12} /> {f.status === "COMPLETED" ? "Pendiente" : "Completada"}
                              </button>
                              <button
                                onClick={() => { setShowDelete(f); setMenuOpen(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={12} /> Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva Actividad" subtitle="Registrar seguimiento a un cliente">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Cliente</label>
            <select
              value={createForm.client_id}
              onChange={(e) => setCreateForm({ ...createForm, client_id: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none"
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Fecha de contacto</label>
              <input type="date" value={createForm.contact_date} onChange={(e) => setCreateForm({ ...createForm, contact_date: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Próximo contacto (opcional)</label>
              <input type="date" value={createForm.next_followup} onChange={(e) => setCreateForm({ ...createForm, next_followup: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Tipo de actividad</label>
            <select value={createForm.activity_type}
              onChange={(e) => setCreateForm({ ...createForm, activity_type: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
              <option value="">Seleccionar tipo...</option>
              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="Otro">Otro (escribir abajo)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea value={createForm.comments} onChange={(e) => setCreateForm({ ...createForm, comments: e.target.value })} rows={3}
              placeholder="Detalles de la actividad..." className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#5C3E35]">Estado:</label>
            {(["PENDING", "COMPLETED"] as const).map((s) => (
              <button key={s} onClick={() => setCreateForm({ ...createForm, status: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${createForm.status === s ? (s === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700") : "bg-[#F5F0EB] text-[#9C8A82]"}`}>
                {s === "COMPLETED" ? "Completada" : "Pendiente"}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="px-5 h-11 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className="px-5 h-11 rounded-xl bg-[#B8837E] text-white text-sm font-medium hover:bg-[#9A6B66] transition-all disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Actividad"}
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Editar Actividad" subtitle={showEdit?.clients?.full_name || ""}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Fecha de contacto</label>
              <input type="date" value={editForm.contact_date} onChange={(e) => setEditForm({ ...editForm, contact_date: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Próximo contacto (opcional)</label>
              <input type="date" value={editForm.next_followup} onChange={(e) => setEditForm({ ...editForm, next_followup: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Tipo de actividad</label>
            <select value={editForm.activity_type}
              onChange={(e) => setEditForm({ ...editForm, activity_type: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
              <option value="">Seleccionar tipo...</option>
              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="Otro">Otro (escribir abajo)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea value={editForm.comments} onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#5C3E35]">Estado:</label>
            {(["PENDING", "COMPLETED", "OVERDUE"] as const).map((s) => (
              <button key={s} onClick={() => setEditForm({ ...editForm, status: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${editForm.status === s ? (s === "COMPLETED" ? "bg-green-100 text-green-700" : s === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700") : "bg-[#F5F0EB] text-[#9C8A82]"}`}>
                {s === "COMPLETED" ? "Completada" : s === "OVERDUE" ? "Vencida" : "Pendiente"}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowEdit(null)} className="px-5 h-11 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleEdit} disabled={saving} className="px-5 h-11 rounded-xl bg-[#B8837E] text-white text-sm font-medium hover:bg-[#9A6B66] transition-all disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Eliminar Actividad">
        <div className="space-y-4">
          <p className="text-sm text-[#5C3E35]">
            ¿Estás seguro de eliminar esta actividad de <strong>{showDelete?.clients?.full_name}</strong>?
          </p>
          <p className="text-xs text-[#9C8A82] bg-[#FAF6F0] p-3 rounded-xl">{showDelete?.comments}</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowDelete(null)} className="px-5 h-11 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleDelete} disabled={saving} className="px-5 h-11 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50">
              {saving ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}