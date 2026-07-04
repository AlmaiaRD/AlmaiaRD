"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getClients, getClientsWithBalances, createClient, updateClient, deleteClient, searchClients } from "@/services/clients";
import { getClientAllInvoices, getClientReceipts } from "@/services/receipts";
import { getClientCredits } from "@/services/credits";
import { getClientFollowups, createFollowup, updateFollowupStatus } from "@/services/followups";
import type { Client } from "@/types/database";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import {
  Users, Plus, Search, Edit2, Trash2, X, Save, Eye, FileText, Phone, Mail, User, MessageSquare, Wallet, Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";
import { SALES_STAGES, RECRUITMENT_STAGES, getStagesForType } from "@/lib/pipeline-constants";
import { updateClientStage } from "@/services/clients";
import type { ClientType } from "@/types/database";

type DetailTab = "info" | "facturas" | "pagos" | "creditos" | "seguimiento";

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente", PARTIAL: "Parcial", PAID: "Pagada", CANCELLED: "Anulada",
};

const statusColor: Record<string, "warning" | "info" | "success" | "danger"> = {
  PENDING: "warning", PARTIAL: "info", PAID: "success", CANCELLED: "danger",
};

export default function ClientesPage() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", ibo_number: "", notes: "", client_type: "comprador" as ClientType, birthday: "" });
  const [saving, setSaving] = useState(false);

  const [detailInvoices, setDetailInvoices] = useState<any[]>([]);
  const [detailReceipts, setDetailReceipts] = useState<any[]>([]);
  const [detailCredits, setDetailCredits] = useState<any[]>([]);
  const [detailFollowups, setDetailFollowups] = useState<any[]>([]);
  const [newFollowup, setNewFollowup] = useState("");

  const load = useCallback(async () => {
    try {
      const data = searchQuery ? await searchClients(searchQuery) : await getClientsWithBalances();
      setClients(data);
    } catch (e: any) {
      console.error("Error al cargar clientes:", e);
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("nuevo") === "true") {
      resetForm();
      setShowModal(true);
    }
  }, [searchParams]);

  function resetForm() {
    setForm({ full_name: "", phone: "", email: "", ibo_number: "", notes: "", client_type: "comprador", birthday: "" });
    setEditingClient(null);
  }

  function openNew() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      full_name: client.full_name,
      phone: client.phone || "",
      email: client.email || "",
      ibo_number: client.ibo_number || "",
      notes: client.notes || "",
      client_type: (client.client_type as ClientType) || "comprador",
      birthday: client.birthday || "",
    });
    setShowModal(true);
  }

  async function openDetail(client: Client) {
    setDetailClient(client);
    setDetailTab("info");
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const [inv, rec, crd, fol] = await Promise.all([
        getClientAllInvoices(client.id),
        getClientReceipts(client.id),
        getClientCredits(client.id),
        getClientFollowups(client.id),
      ]);
      setDetailInvoices(inv);
      setDetailReceipts(rec);
      setDetailCredits(crd);
      setDetailFollowups(fol);
    } catch {
      toast.error("Error al cargar detalle del cliente");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSave() {
    if (!form.full_name.trim()) { toast.error("El nombre del cliente es requerido"); return; }
    setSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, form);
        toast.success("Cliente actualizado exitosamente");
      } else {
        await createClient(form);
        toast.success("Cliente creado exitosamente");
      }
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      const clientId = editingClient?.id || "N/A";
      const msg = e?.message || e?.error?.message || e?.error_description || (typeof e === 'object' ? JSON.stringify(e) : String(e));
      toast.error(`Error (${clientId}): ${msg}`);
      console.error("[handleSave]", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Estás segura de eliminar a ${name}?`)) return;
    try {
      await deleteClient(id);
      toast.success("Cliente eliminado");
      load();
    } catch {
      toast.error("Error al eliminar cliente");
    }
  }

  async function handleAddFollowup() {
    if (!detailClient || !newFollowup.trim()) return;
    try {
      await createFollowup({
        client_id: detailClient.id,
        contact_date: getLocalDateString(),
        comments: newFollowup,
        status: "PENDING",
      });
      const fol = await getClientFollowups(detailClient.id);
      setDetailFollowups(fol);
      setNewFollowup("");
      toast.success("Actividad registrada");
    } catch {
      toast.error("Error al registrar actividad");
    }
  }

  async function handleToggleFollowup(id: string, current: string) {
    try {
      await updateFollowupStatus(id, current === "COMPLETED" ? "PENDING" : "COMPLETED");
      if (detailClient) {
        const fol = await getClientFollowups(detailClient.id);
        setDetailFollowups(fol);
      }
    } catch {
      toast.error("Error al actualizar seguimiento");
    }
  }

  async function handleConvertClientType(client: Client, newType: ClientType) {
    const label = newType === "negocio" ? "Prospecto de Negocio" : "Cliente Comprador";
    if (!window.confirm(`¿Convertir a ${client.full_name} como ${label}?`)) return;
    
    try {
      await updateClient(client.id, {
        client_type: newType,
        stage: newType === "negocio" ? "prospecto" : "lead",
        stage_entered_at: new Date().toISOString(),
        client_type_changed_at: new Date().toISOString(),
        previous_client_type: client.client_type,
      });
      toast.success(`Cliente convertido a ${label}`);
      load();
      setDetailClient(null);
    } catch (e: any) {
      toast.error("Error al convertir cliente");
    }
  }

  const totalPortfolio = clients.reduce((sum: number, c: any) => sum + Number(c.pending_balance || 0), 0);
  const totalCreditBalance = clients.reduce((sum: number, c: any) => sum + Number(c.credit_balance || 0), 0);
  const totalInvoiced = detailInvoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = detailReceipts.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <PageContainer>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#5C3E35]">Clientes y Deudas</h1>
              <p className="text-sm text-[#9C8A82] mt-1">Directorio de clientes</p>
            </div>
            <button onClick={openNew} className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              <Plus size={18} /> Añadir
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar cliente por nombre, teléfono o correo..." className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay clientes registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map((client: any) => {
                const pending = Number(client.pending_balance || 0);
                const credit = Number(client.credit_balance);
                const stage = getStagesForType((client.client_type as ClientType) || "comprador").find(s => s.key === client.stage);
                return (
                  <div key={client.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <button onClick={() => openDetail(client)} className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-[#5C3E35] hover:text-[#B8837E] transition-colors">{client.full_name}</h3>
                          {stage && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stage.bg} ${stage.color}`}>
                              {stage.label}
                            </span>
                          )}
                          {client.client_type === "negocio" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">Negocio</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#9C8A82]">
                          {client.phone && <span className="flex items-center gap-1"><Phone size={12} />{client.phone}</span>}
                          {client.email && <span className="flex items-center gap-1"><Mail size={12} />{client.email}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          {pending > 0 ? (
                            <>
                              <span className="text-sm text-[#5C3E35]">Pendiente: <strong>{formatCurrency(pending)}</strong></span>
                              <Badge variant="danger">DEBE {formatCurrency(pending)}</Badge>
                            </>
                          ) : credit > 0 ? (
                            <>
                              <span className="text-sm text-[#5C3E35]">A favor: <strong>{formatCurrency(credit)}</strong></span>
                              <Badge variant="success">A FAVOR {formatCurrency(credit)}</Badge>
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-[#5C3E35]">Saldo: <strong>{formatCurrency(0)}</strong></span>
                              <Badge variant="neutral">SALDADO</Badge>
                            </>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 ml-4">
                        <select
                          value={client.stage || ""}
                          onChange={async e => {
                            e.stopPropagation();
                            try {
                              await updateClientStage(client.id, e.target.value);
                              load();
                              toast.success("Etapa actualizada");
                            } catch { toast.error("Error al actualizar"); }
                          }}
                          className="h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-xs text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                        >
                          <option value="">Sin etapa</option>
                          {getStagesForType((client.client_type as ClientType) || "comprador").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <button onClick={() => openEdit(client)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(client.id, client.full_name)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] h-fit">
          <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Estado de Cuenta Almaia RD</h3>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm py-2 border-b border-[#E8E0D8]/50">
              <span className="text-[#9C8A82]">Cartera total (pendiente)</span>
              <span className="font-medium">{formatCurrency(totalPortfolio)}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-[#E8E0D8]/50">
              <span className="text-[#9C8A82]">Saldos a favor</span>
              <span className="font-medium text-[#86C7A3]">{formatCurrency(totalCreditBalance)}</span>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-[#9C8A82] uppercase tracking-wider mb-3">Accesos rápidos</h4>
          <div className="space-y-2">
            <a href="/creditos" className="flex items-center gap-2 text-sm text-[#86C7A3] hover:underline">
              <Wallet size={14} /> Ver Saldos a Favor
            </a>
            <a href="/crm" className="flex items-center gap-2 text-sm text-[#B8837E] hover:underline">
              <MessageSquare size={14} /> Ver Seguimiento
            </a>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setDetailClient(null); }} title={detailClient?.full_name || "Detalle"} wide>
        {detailClient && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#B8837E]/10 flex items-center justify-center">
                  <User size={22} className="text-[#B8837E]" />
                </div>
                <div>
                  <p className="text-sm text-[#9C8A82]">
                    {detailClient.phone && `Tel: ${detailClient.phone}`}
                    {detailClient.phone && detailClient.email && " · "}
                    {detailClient.email && detailClient.email}
                  </p>
                  {detailClient.ibo_number && <p className="text-xs text-[#9C8A82]">IBO: {detailClient.ibo_number}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {detailClient.client_type === "comprador" ? (
                  <button 
                    onClick={() => handleConvertClientType(detailClient, "negocio")} 
                    className="flex items-center gap-1.5 text-sm text-[#86C7A3] hover:underline"
                  >
                    <Briefcase size={14} /> <span className="hidden sm:inline">Convertir a Prospecto</span><span className="sm:hidden">Prospecto</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleConvertClientType(detailClient, "comprador")} 
                    className="flex items-center gap-1.5 text-sm text-[#B8837E] hover:underline"
                  >
                    <User size={14} /> <span className="hidden sm:inline">Convertir a Comprador</span><span className="sm:hidden">Comprador</span>
                  </button>
                )}
                <button onClick={() => openEdit(detailClient)} className="flex items-center gap-1.5 text-sm text-[#B8837E] hover:underline"><Edit2 size={14} /> Editar</button>
              </div>
            </div>

            {detailClient.previous_client_type && detailClient.client_type_changed_at && (
              <div className="bg-[#FAF6F0] rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#B8837E]/10 flex items-center justify-center">
                  <Briefcase size={14} className="text-[#B8837E]" />
                </div>
                <div>
                  <p className="text-xs text-[#9C8A82]">
                    Fue {detailClient.previous_client_type === "comprador" ? "Cliente Comprador" : "Prospecto de Negocio"} por{" "}
                    {Math.floor((new Date(detailClient.client_type_changed_at).getTime() - new Date(detailClient.created_at).getTime()) / (1000 * 60 * 60 * 24))} días
                  </p>
                  <p className="text-xs text-[#9C8A82]">
                    Convertido el {formatDate(detailClient.client_type_changed_at)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-1 border-b border-[#E8E0D8] overflow-x-auto">
              {(["info", "facturas", "pagos", "creditos", "seguimiento"] as DetailTab[]).map((tab) => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`pb-2.5 px-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                    detailTab === tab ? "text-[#B8837E] border-[#B8837E]" : "text-[#9C8A82] border-transparent hover:text-[#5C3E35]"
                  }`}
                >
                  {tab === "info" && "Información"}
                  {tab === "facturas" && `Facturas (${detailInvoices.length})`}
                  {tab === "pagos" && `Pagos (${detailReceipts.length})`}
                  {tab === "creditos" && `Créditos (${detailCredits.length})`}
                  {tab === "seguimiento" && `Seguimiento (${detailFollowups.length})`}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detailTab === "info" ? (
              <div className="space-y-3">
                {detailClient.notes && (
                  <div className="bg-[#FAF6F0] rounded-xl p-4">
                    <p className="text-xs text-[#9C8A82] mb-1">Notas</p>
                    <p className="text-sm text-[#5C3E35]">{detailClient.notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-4 border border-[#E8E0D8]">
                    <p className="text-xs text-[#9C8A82]">Total facturado</p>
                    <p className="text-lg font-bold text-[#5C3E35]">{formatCurrency(totalInvoiced)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-[#E8E0D8]">
                    <p className="text-xs text-[#9C8A82]">Total pagado</p>
                    <p className="text-lg font-bold text-[#86C7A3]">{formatCurrency(totalPaid)}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82]">Saldo pendiente</p>
                  <p className="text-lg font-bold text-[#B8837E]">{formatCurrency(Math.max(0, totalInvoiced - totalPaid))}</p>
                </div>
              </div>
            ) : detailTab === "facturas" ? (
              <div className="space-y-2">
                {detailInvoices.length === 0 ? (
                  <div className="text-center py-10 text-[#9C8A82] text-sm">Sin facturas registradas</div>
                ) : (
                  detailInvoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{inv.invoice_number}</p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(inv.invoice_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(inv.total)}</p>
                        <Badge variant={statusColor[inv.status]}>{statusLabel[inv.status]}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : detailTab === "pagos" ? (
              <div className="space-y-2">
                {detailReceipts.length === 0 ? (
                  <div className="text-center py-10 text-[#9C8A82] text-sm">Sin pagos registrados</div>
                ) : (
                  detailReceipts.map((rec: any) => (
                    <div key={rec.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{rec.receipt_number}</p>
                        <p className="text-xs text-[#9C8A82]">
                          {formatDate(rec.created_at)} · {rec.payment_method === "CASH" ? "Efectivo" : rec.payment_method === "TRANSFER" ? "Transferencia" : "Tarjeta"}
                          {rec.invoices?.invoice_number && ` · ${rec.invoices.invoice_number}`}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-[#86C7A3]">{formatCurrency(rec.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            ) : detailTab === "creditos" ? (
              <div className="space-y-2">
                {detailCredits.length === 0 ? (
                  <div className="text-center py-10 text-[#9C8A82] text-sm">Sin créditos disponibles</div>
                ) : (
                  detailCredits.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className="text-sm text-[#5C3E35]">Recibo {c.receipts?.receipt_number || "—"}</p>
                        <p className="text-xs text-[#9C8A82]">Monto: {formatCurrency(c.amount)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          c.status === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {c.status === "AVAILABLE" ? "Disponible" : c.status === "USED" ? "Usado" : "Vencido"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text" value={newFollowup} onChange={(e) => setNewFollowup(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFollowup()}
                    placeholder="Nueva actividad de seguimiento..."
                    className="flex-1 h-10 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                  />
                  <button onClick={handleAddFollowup} className="h-10 px-4 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all">
                    <Plus size={16} />
                  </button>
                </div>

                {detailFollowups.length === 0 ? (
                  <div className="text-center py-10 text-[#9C8A82] text-sm">Sin actividades de seguimiento</div>
                ) : (
                  <div className="space-y-2">
                    {detailFollowups.map((f) => (
                      <div key={f.id} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-[#E8E0D8]">
                        <div className="w-8 h-8 rounded-full bg-[#FAF6F0] flex items-center justify-center flex-shrink-0">
                          <MessageSquare size={14} className="text-[#B8837E]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[#5C3E35]">Seguimiento</p>
                            <button
                              onClick={() => handleToggleFollowup(f.id, f.status)}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                                f.status === "COMPLETED"
                                  ? "bg-green-100 text-green-700 hover:bg-yellow-100 hover:text-yellow-700"
                                  : "bg-yellow-100 text-yellow-700 hover:bg-green-100 hover:text-green-700"
                              }`}
                            >
                              {f.status === "COMPLETED" ? "Completada" : "Pendiente"}
                            </button>
                          </div>
                          <p className="text-sm text-[#5C3E35] mt-1">{f.comments}</p>
                          <p className="text-xs text-[#9C8A82] mt-1">{formatDate(f.contact_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingClient ? "Editar Cliente" : "Nuevo Cliente"} subtitle="Registra la información del cliente">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Tipo de cliente *</label>
            <div className="flex gap-3">
              {([["comprador", "Cliente Comprador", "Compra productos"], ["negocio", "Prospecto de Negocio", "Posible IBO / Demo"]] as const).map(([value, label, desc]) => (
                <button key={value} type="button" onClick={() => setForm({ ...form, client_type: value as ClientType })}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${form.client_type === value ? "border-[#B8837E] bg-[#B8837E]/5" : "border-[#E8E0D8] bg-white hover:bg-[#FAF6F0]"}`}>
                  <p className="text-sm font-medium text-[#5C3E35]">{label}</p>
                  <p className="text-xs text-[#9C8A82] mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre completo *</label>
            <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nombre y apellidos" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Teléfono</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="809-000-0000" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Correo electrónico</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha de cumpleaños</label>
            <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Número IBO (opcional)</label>
            <input type="text" value={form.ibo_number} onChange={(e) => setForm({ ...form, ibo_number: e.target.value })} placeholder="IBO" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Información adicional del cliente..." rows={3} className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
