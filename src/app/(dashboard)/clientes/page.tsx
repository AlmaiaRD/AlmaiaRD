"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { getClients, getClientsWithBalances, updateClient, deleteClient, searchClients, getArchivedClients, restoreClient, getClientsPaginated } from "@/services/clients";
import ClientFormModal, { type ClientFormValues } from "@/components/clients/ClientFormModal";
import { getClientAllInvoices, getClientReceipts } from "@/services/receipts";
import { getClientCredits } from "@/services/credits";
import { getClientFollowups, createFollowup, updateFollowupStatus } from "@/services/followups";
import { getClientQuotes } from "@/services/quotes";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Client } from "@/types/database";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import {
  Users, Plus, Search, Edit2, Trash2, X, Eye, FileText, Phone, Mail, User, MessageSquare, Wallet, Briefcase, Archive, RotateCcw, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { SALES_STAGES, RECRUITMENT_STAGES, getStagesForType } from "@/lib/pipeline-constants";
import { updateClientStage } from "@/services/clients";
import type { ClientType } from "@/types/database";

type DetailTab = "info" | "facturas" | "pagos" | "creditos" | "seguimiento" | "cotizaciones";

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
  const [clientFormInitial, setClientFormInitial] = useState<Partial<ClientFormValues> | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [detailInvoices, setDetailInvoices] = useState<any[]>([]);
  const [detailReceipts, setDetailReceipts] = useState<any[]>([]);
  const [detailCredits, setDetailCredits] = useState<any[]>([]);
  const [detailFollowups, setDetailFollowups] = useState<any[]>([]);
  const [detailQuotes, setDetailQuotes] = useState<any[]>([]);
  const [newFollowup, setNewFollowup] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedClients, setArchivedClients] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const pageSize = 50;

  const load = useCallback(async (p?: number) => {
    const currentPage = p ?? page;
    try {
      if (searchQuery) {
        const data = await searchClients(searchQuery);
        setClients(data);
        setTotalClients(data.length);
      } else {
        const result = await getClientsPaginated(currentPage, pageSize);
        setClients(result.data);
        setTotalClients(result.total);
      }
    } catch (e: any) {
      console.error("Error al cargar clientes:", e);
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    (async () => {
      try {
        const data = searchQuery ? await searchClients(searchQuery) : await getClientsWithBalances();
        setClients(data);
        setTotalClients(data.length);
      } catch (e: any) {
        console.error("Error al cargar clientes:", e);
        toast.error("Error al cargar clientes");
      } finally {
        setLoading(false);
      }
    })();
  }, [searchQuery]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    setLoading(true);
    load(newPage);
  }

  useEffect(() => {
    if (searchParams.get("nuevo") === "true") {
      setEditingClient(null);
      setClientFormInitial(undefined);
      setShowModal(true);
    }
  }, [searchParams]);

  function resetForm() {
    setEditingClient(null);
    setClientFormInitial(undefined);
  }

  function openNew() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setClientFormInitial({
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

  function handleClientSaved() {
    toast.success(editingClient ? "Cliente actualizado exitosamente" : "Cliente creado exitosamente");
    setShowModal(false);
    resetForm();
    load();
  }

  async function openDetail(client: Client) {
    setDetailClient(client);
    setDetailTab("info");
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const [inv, rec, crd, fol, qts] = await Promise.all([
        getClientAllInvoices(client.id),
        getClientReceipts(client.id),
        getClientCredits(client.id),
        getClientFollowups(client.id),
        getClientQuotes(client.id),
      ]);
      setDetailInvoices(inv);
      setDetailReceipts(rec);
      setDetailCredits(crd);
      setDetailFollowups(fol);
      setDetailQuotes(qts);
    } catch {
      toast.error("Error al cargar detalle del cliente");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Archivar a ${name}?`)) return;
    const previous = clients;
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast.success("Cliente archivado. Puedes restaurarlo desde Archivos.", { duration: 4000 });
    try {
      await deleteClient(id);
      load();
    } catch {
      setClients(previous);
      toast.error("Error al archivar cliente");
    }
  }

  async function handleRestore(id: string, name: string) {
    if (!window.confirm(`¿Restaurar a ${name}?`)) return;
    const previous = archivedClients;
    setArchivedClients((prev) => prev.filter((c) => c.id !== id));
    toast.success("Cliente restaurado exitosamente");
    try {
      await restoreClient(id);
      load();
    } catch {
      setArchivedClients(previous);
      toast.error("Error al restaurar cliente");
    }
  }

  async function openArchived() {
    try {
      const data = await getArchivedClients();
      setArchivedClients(data);
      setShowArchived(true);
    } catch {
      toast.error("Error al cargar clientes archivados");
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

  useKeyboardShortcuts([
    { key: "n", ctrl: true, handler: () => { resetForm(); setShowModal(true); } },
    { key: "Escape", handler: () => { if (showModal) { setShowModal(false); resetForm(); } if (showDetail) setShowDetail(false); } },
    { key: "/", handler: () => searchInputRef.current?.focus() },
    { key: "f", ctrl: true, handler: () => searchInputRef.current?.focus() },
  ]);

  return (
    <PageContainer>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#5C3E35]">Clientes y Deudas</h1>
              <p className="text-sm text-[#9C8A82] mt-1">Directorio de clientes</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/cotizaciones?nueva=true" className="flex items-center gap-2 bg-[#C9A89C] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#B08E82] transition-all">
                <ClipboardList size={16} /> Cotizar
              </Link>
              <button onClick={openArchived} className="flex items-center gap-2 bg-white text-[#9C8A82] px-4 py-2.5 rounded-xl text-sm font-medium border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-all">
                <Archive size={16} /> Archivados
              </button>
              <button onClick={openNew} className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
                <Plus size={18} /> Añadir
              </button>
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
            <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar cliente por nombre, teléfono o correo..." className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay clientes registrados</p>
            </div>
          ) : !searchQuery && totalClients > pageSize ? (
            <>
            <div className="space-y-3">
              {clients.map((client: any) => {
                const pending = Number(client.pending_balance || 0);
                const credit = Number(client.credit_balance);
                const stage = getStagesForType((client.client_type as ClientType) || "comprador").find(s => s.key === client.stage);
                return (
                  <div key={client.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <button onClick={() => openDetail(client)} className="flex-1 min-w-0 text-left">
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
                      <div className="flex items-center gap-2 sm:ml-4 flex-wrap">
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
                          className="h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-xs text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 max-w-[150px]"
                        >
                          <option value="">Sin etapa</option>
                          {getStagesForType((client.client_type as ClientType) || "comprador").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <button onClick={() => openEdit(client)} className="p-2.5 sm:p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(client.id, client.full_name)} className="p-2.5 sm:p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} pageSize={pageSize} total={totalClients} onPageChange={handlePageChange} />
            </>
          ) : (
            <div className="space-y-3">
              {clients.map((client: any) => {
                const pending = Number(client.pending_balance || 0);
                const credit = Number(client.credit_balance);
                const stage = getStagesForType((client.client_type as ClientType) || "comprador").find(s => s.key === client.stage);
                return (
                  <div key={client.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <button onClick={() => openDetail(client)} className="flex-1 min-w-0 text-left">
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
                      <div className="flex items-center gap-2 sm:ml-4 flex-wrap">
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
                          className="h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-xs text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 max-w-[150px]"
                        >
                          <option value="">Sin etapa</option>
                          {getStagesForType((client.client_type as ClientType) || "comprador").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <button onClick={() => openEdit(client)} className="p-2.5 sm:p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(client.id, client.full_name)} className="p-2.5 sm:p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg"><Trash2 size={16} /></button>
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
              {(["info", "facturas", "pagos", "creditos", "seguimiento", "cotizaciones"] as DetailTab[]).map((tab) => (
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
                  {tab === "cotizaciones" && `Cotizaciones (${detailQuotes.length})`}
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
            ) : detailTab === "seguimiento" ? (
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
                  <>
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
                    <Pagination page={page} pageSize={pageSize} total={totalClients} onPageChange={handlePageChange} />
                  </>
                )}
              </div>
            ) : detailTab === "cotizaciones" ? (
              <div className="space-y-2">
                {detailQuotes.length === 0 ? (
                  <div className="text-center py-10 text-[#9C8A82] text-sm">Sin cotizaciones registradas</div>
                ) : (
                  detailQuotes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{q.quote_number}</p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(q.quote_date)} · Válida hasta {formatDate(q.valid_until)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(q.total)}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          q.status === "DRAFT" ? "bg-gray-100 text-gray-600" :
                          q.status === "SENT" ? "bg-[#B8837E]/10 text-[#B8837E]" :
                          q.status === "ACCEPTED" || q.status === "CONVERTED" ? "bg-green-100 text-green-700" :
                          "bg-red-100 text-red-600"
                        }`}>
                          {q.status === "DRAFT" ? "Borrador" : q.status === "SENT" ? "Enviada" : q.status === "ACCEPTED" ? "Aceptada" : q.status === "CONVERTED" ? "Convertida" : q.status === "REJECTED" ? "Rechazada" : "Cancelada"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-[#9C8A82] text-sm">Selecciona una pestaña</div>
            )}
          </div>
        )}
      </Modal>

      <ClientFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        onSaved={handleClientSaved}
        initial={clientFormInitial}
        clientId={editingClient?.id}
        title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}
        subtitle="Registra la información del cliente"
      />
      <Modal isOpen={showArchived} onClose={() => setShowArchived(false)} title="Clientes Archivados" subtitle="Restaura clientes previamente archivados">
        {archivedClients.length === 0 ? (
          <div className="text-center py-10 text-[#9C8A82] text-sm">No hay clientes archivados</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {archivedClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                <div>
                  <p className="text-sm font-medium text-[#5C3E35]">{client.full_name}</p>
                  <p className="text-xs text-[#9C8A82]">{client.phone || client.email || "Sin contacto"}</p>
                </div>
                <button
                  onClick={() => handleRestore(client.id, client.full_name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF6F0] text-[#5C3E35] rounded-lg text-xs font-medium hover:bg-[#B8837E]/10 transition-all"
                >
                  <RotateCcw size={14} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
