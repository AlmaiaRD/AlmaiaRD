"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getCommunications, deleteCommunication, updateCommunication } from "@/services/communications";
import { formatDate } from "@/lib/utils";
import { Search, Mail, MessageCircle, Trash2, Send, Edit2, Eye, Plus, FileText, Sparkles } from "lucide-react";
import MessageComposer from "@/components/communications/MessageComposer";
import toast from "react-hot-toast";

type Tab = "historial" | "componer";

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  draft: { label: "Borrador", variant: "warning" },
  sent: { label: "Enviado", variant: "success" },
  failed: { label: "Error", variant: "danger" },
};

export default function ComunicacionesPage() {
  const [comms, setComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [detailComm, setDetailComm] = useState<any | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [smtp, setSmtp] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("historial");
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCommunications();
        setComms(data);
        const { getSettings } = await import("@/services/settings");
        const st = await getSettings();
        if ((st as any)?.smtp_host) setSmtp(st);
      } catch { toast.error("Error al cargar comunicaciones"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function openDetail(c: any) {
    setDetailComm(c);
    setEditSubject(c.subject || "");
    setEditBody(c.body || "");
  }

  async function handleSaveEdit() {
    if (!detailComm) return;
    setSaving(true);
    try {
      await updateCommunication(detailComm.id, {
        subject: editSubject,
        body: editBody,
      });
      setComms(prev => prev.map(c => c.id === detailComm.id ? { ...c, subject: editSubject, body: editBody } : c));
      toast.success("Borrador actualizado");
      setDetailComm(null);
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleMarkSent() {
    if (!detailComm) return;
    try {
      await updateCommunication(detailComm.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      setComms(prev => prev.map(c => c.id === detailComm.id ? { ...c, status: "sent", sent_at: new Date().toISOString() } : c));
      toast.success("Marcado como enviado");
      setDetailComm(null);
    } catch { toast.error("Error al marcar"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta comunicación?")) return;
    try {
      await deleteCommunication(id);
      setComms(prev => prev.filter(x => x.id !== id));
      toast.success("Comunicación eliminada");
      if (detailComm?.id === id) setDetailComm(null);
    } catch { toast.error("Error al eliminar"); }
  }

  const filtered = comms.filter(c => {
    if (filterType && c.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = c.clients?.full_name?.toLowerCase() || "";
      const subject = c.subject?.toLowerCase() || "";
      if (!name.includes(q) && !subject.includes(q)) return false;
    }
    return true;
  });

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Centro de Comunicaciones</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Gestiona tus mensajes y comunicaciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E8E0D8] mb-6">
        <button
          onClick={() => setActiveTab("historial")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "historial"
              ? "text-[#B8837E] border-[#B8837E]"
              : "text-[#9C8A82] border-transparent hover:text-[#5C3E35]"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            Historial de Mensajes
          </div>
        </button>
        <button
          onClick={() => setActiveTab("componer")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "componer"
              ? "text-[#B8837E] border-[#B8837E]"
              : "text-[#9C8A82] border-transparent hover:text-[#5C3E35]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            Componer Mensaje
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "historial" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente o asunto..."
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="h-12 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm">
              <option value="">Todos</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Mail size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay comunicaciones registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const s = statusMap[c.status] || statusMap.draft;
                return (
                  <div key={c.id}
                    onClick={() => openDetail(c)}
                    className="bg-white rounded-xl border border-[#E8E0D8] p-4 hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {c.type === "email" ? <Mail size={16} className="text-[#B8837E]" /> : <MessageCircle size={16} className="text-[#86C7A3]" />}
                          <span className="text-sm font-semibold text-[#5C3E35] capitalize">{c.type}</span>
                          <Badge variant={s.variant}>{s.label}</Badge>
                          {c.document_type && (
                            <span className="text-xs text-[#9C8A82]">{c.document_type === "invoice" ? "Factura" : "Recibo"}</span>
                          )}
                        </div>
                        <p className="text-sm text-[#5C3E35] font-medium truncate">{c.clients?.full_name || "—"}</p>
                        {c.subject && <p className="text-xs text-[#9C8A82] mt-0.5 truncate">{c.subject}</p>}
                        {c.body && <p className="text-xs text-[#9C8A82] mt-1 line-clamp-2">{c.body}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[#9C8A82]">
                          <span>Creado: {formatDate(c.created_at)}</span>
                          {c.sent_at && <span>Enviado: {formatDate(c.sent_at)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openDetail(c)}
                          className="p-1.5 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg"><Eye size={15} /></button>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-[#9C8A82] hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Sparkles size={40} className="mx-auto mb-4 text-[#B8837E] opacity-40" />
          <p className="text-sm text-[#9C8A82] mb-4">Crea mensajes personalizados para tus clientes</p>
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-2 bg-[#B8837E] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
          >
            <Plus size={18} />
            Componer Nuevo Mensaje
          </button>
        </div>
      )}

      <MessageComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        onSaved={() => {
          getCommunications().then(setComms).catch(() => {});
          setShowComposer(false);
          setActiveTab("historial");
        }}
      />

      <Modal isOpen={!!detailComm} onClose={() => setDetailComm(null)}
        title={detailComm?.type === "email" ? "Email" : "WhatsApp"}
        subtitle={detailComm?.clients?.full_name || ""}
        wide
      >
        {detailComm && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={(statusMap[detailComm.status] || statusMap.draft).variant}>
                {(statusMap[detailComm.status] || statusMap.draft).label}
              </Badge>
              {detailComm.document_type && (
                <span className="text-xs text-[#9C8A82]">
                  {detailComm.document_type === "invoice" ? "Factura" : "Recibo"}
                </span>
              )}
              <span className="text-xs text-[#9C8A82]">Creado: {formatDate(detailComm.created_at)}</span>
              {detailComm.sent_at && <span className="text-xs text-[#9C8A82]">Enviado: {formatDate(detailComm.sent_at)}</span>}
            </div>

            {detailComm.type === "email" && (
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Asunto</label>
                <input type="text" value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
              <textarea value={editBody} rows={12}
                onChange={e => setEditBody(e.target.value)}
                className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 whitespace-pre-wrap" />
            </div>

            <div className="flex gap-3 pt-2">
              {detailComm.status === "draft" && (
                <>
                  <button onClick={handleSaveEdit} disabled={saving}
                    className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all disabled:opacity-50">
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                  {detailComm.type === "email" && (
                    <button onClick={async () => {
                      if (!smtp?.smtp_host) {
                        toast.error("Configura SMTP en Ajustes primero");
                        return;
                      }
                      try {
                        const res = await fetch("/api/send-email", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            to: detailComm.clients?.email || "",
                            subject: editSubject,
                            body: editBody,
                            smtp: {
                              host: smtp.smtp_host,
                              port: smtp.smtp_port || 587,
                              user: smtp.smtp_user,
                              pass: smtp.smtp_pass,
                              secure: smtp.smtp_secure || false,
                              senderName: smtp.sender_name || undefined,
                            },
                          }),
                        });
                        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                        await handleMarkSent();
                        toast.success("Email enviado correctamente");
                      } catch (err: any) {
                        toast.error(err?.message || "Error al enviar email");
                      }
                    }}
                      className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all flex items-center justify-center gap-2">
                      <Send size={16} /> Enviar Email
                    </button>
                  )}
                  <button onClick={handleMarkSent}
                    className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                    <Send size={16} /> Marcar como Enviado
                  </button>
                </>
              )}
              <button onClick={() => setDetailComm(null)}
                className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
