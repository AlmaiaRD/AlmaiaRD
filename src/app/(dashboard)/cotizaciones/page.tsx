"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import CommunicationDraftModal from "@/components/communications/CommunicationDraftModal";
import { getQuotes, getQuote, createQuote, updateQuote, deleteQuote, updateQuoteStatus, type QuoteWithClient, type QuoteItemWithProduct } from "@/services/quotes";
import { getClients } from "@/services/clients";
import ClientFormModal from "@/components/clients/ClientFormModal";
import { getProducts } from "@/services/products";
import { getSettings } from "@/services/settings";
import { getFollowupsByQuote } from "@/services/followups";
import { getBankAccounts } from "@/services/invoices";
import type { Client, Followup, Settings } from "@/types/database";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import { normalize } from "@/lib/search";
import { computeInvoiceMath } from "@/lib/invoiceMath";
import { buildQuotePdfDoc, generateQuotePdf } from "@/lib/pdf";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Printer, Edit2, Trash2, X, Save, Mail, MessageCircle, FileText, CheckCircle2, XCircle, Ban, ArrowRightLeft, Send } from "lucide-react";
import toast from "react-hot-toast";

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  SENT: { label: "Enviada", variant: "info" },
  ACCEPTED: { label: "Aceptada", variant: "success" },
  REJECTED: { label: "Rechazada", variant: "danger" },
  CANCELLED: { label: "Cancelada", variant: "danger" },
  CONVERTED: { label: "Convertida", variant: "success" },
};

interface FormItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  price_30?: number;
  price_35?: number;
  cost: number;
  pv: number;
  itbis: boolean;
}

export default function CotizacionesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FCFAF7]"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>}>
      <CotizacionesContent />
    </Suspense>
  );
}

function CotizacionesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("DRAFT");
  const [saving, setSaving] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithClient | null>(null);
  const [detailItems, setDetailItems] = useState<QuoteItemWithProduct[]>([]);
  const [detailFollowups, setDetailFollowups] = useState<Followup[]>([]);
  const [draftModal, setDraftModal] = useState<{ type: "email" | "whatsapp" } | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  const [clientId, setClientId] = useState("");
  const [quoteDate, setQuoteDate] = useState(getLocalDateString());
  const [validUntil, setValidUntil] = useState(getLocalDateString(new Date(Date.now() + 30 * 86400000)));
  const [margin, setMargin] = useState(30);
  const [items, setItems] = useState<FormItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showManualProduct, setShowManualProduct] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: "", quantity: 1, unit_price: 0, cost: 0, itbis: false });

  const productFiltered = products.filter(p => p.active && (!productSearch || normalize(p.name).includes(normalize(productSearch)) || (p.code && normalize(p.code).includes(normalize(productSearch)))));

  async function handleSavedNewClient(client: any) {
    try {
      const fresh = await getClients();
      setClients(fresh);
      setClientId(client.id);
      setShowNewClient(false);
      toast.success("Cliente agregado");
    } catch (e) {
      console.error("Error refreshing clients:", e);
      toast.error("Cliente creado, pero no se pudo actualizar la lista");
    }
  }

  const load = useCallback(async () => {
    try {
      const [q, cl, pr, st] = await Promise.all([
        getQuotes(),
        getClients(),
        getProducts(),
        getSettings().catch(() => null),
      ]);
      setQuotes(q);
      setClients(cl);
      setProducts(pr);
      setSettings(st);
      setMargin(st?.default_margin ?? 30);
    } catch {
      toast.error("Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && searchParams.get("nueva") === "true") {
      openNew();
    }
  }, [loading, searchParams]);

  const filtered = quotes.filter((q) => {
    if (filterStatus && q.status !== filterStatus) return false;
    if (filterClient && q.client_id !== filterClient) return false;
    if (searchQuery) {
      const qs = normalize(searchQuery);
      const hay = normalize(`${q.quote_number} ${q.clients?.full_name || ""}`);
      if (!hay.includes(qs)) return false;
    }
    return true;
  });

  function resetForm() {
    setClientId("");
    setQuoteDate(getLocalDateString());
    setValidUntil(getLocalDateString(new Date(Date.now() + 30 * 86400000)));
    setMargin(settings?.default_margin ?? 30);
    setItems([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setNotes("");
    setEditingId(null);
    setEditingStatus("DRAFT");
  }

  function openNew() {
    resetForm();
    setShowProducts(false);
    setShowManualProduct(false);
    setShowModal(true);
  }

  async function openEdit(id: string) {
    try {
      const { quote, items: quoteItems } = await getQuote(id);
      setClientId(quote.client_id);
      setQuoteDate(quote.quote_date);
      setValidUntil(quote.valid_until || getLocalDateString(new Date(Date.now() + 30 * 86400000)));
      setMargin(quote.margin ?? settings?.default_margin ?? 30);
      setNotes(quote.notes || "");
      setDiscountAmount(Number(quote.discount_amount) || 0);
      const subPlusItbis = Number(quote.subtotal) + Number(quote.itbis_total);
      const pct = subPlusItbis > 0 ? Math.round((Number(quote.discount_amount) / subPlusItbis) * 100) : 0;
      setDiscountPercent(pct > 0 && pct < 100 ? pct : 0);
      setEditingStatus(quote.status);
      setItems(quoteItems.map((i) => ({
        product_id: i.product_id || "",
        name: i.products?.name || i.custom_name || "Producto",
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        cost: Number(i.unit_cost) || 0,
        pv: Number(i.pv) || 0,
        itbis: Boolean(i.itbis),
      })));
      setEditingId(id);
      setShowProducts(false);
      setShowManualProduct(false);
      setShowModal(true);
    } catch {
      toast.error("Error al cargar la cotización");
    }
  }

  function effectivePrice(item: FormItem) {
    if (item.unit_price) return item.unit_price;
    return margin === 30 ? (item.price_30 ?? 0) : (item.price_35 ?? 0);
  }

  async function addProduct(product: any) {
    const price_30_ = product.price_30 ?? 0;
    const price_35_ = product.price_35 ?? 0;
    const base: FormItem = {
      product_id: product.id,
      name: product.name,
      quantity: 1,
      unit_price: margin === 30 ? price_30_ : price_35_,
      price_30: price_30_,
      price_35: price_35_,
      cost: product.cost ?? 0,
      pv: product.pv ?? 0,
      itbis: product.apply_itbis !== false,
    };
    setItems([...items, base]);
    setShowProducts(false);
    setProductSearch("");
  }

  function addManualProduct() {
    if (!manualProduct.name.trim()) { toast.error("El nombre del producto es requerido"); return; }
    if (manualProduct.unit_price <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    setItems([...items, {
      product_id: "",
      name: manualProduct.name,
      quantity: manualProduct.quantity,
      unit_price: manualProduct.unit_price,
      cost: manualProduct.cost || 0,
      pv: 0,
      itbis: manualProduct.itbis,
    }]);
    setManualProduct({ name: "", quantity: 1, unit_price: 0, cost: 0, itbis: false });
    setShowManualProduct(false);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<FormItem>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  // Cálculo único de invoice math (con descuento aplicado)
  const rawSubtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * effectivePrice(i), 0);
  const discountValue = Math.round((discountAmount > 0 ? discountAmount : rawSubtotal * discountPercent / 100) * 100) / 100;
  const math = useMemo(() => computeInvoiceMath(
    items.map((i) => ({ quantity: i.quantity, unit_price: effectivePrice(i), cost: i.cost, itbis: i.itbis })),
    discountValue
  ), [items, margin, discountPercent, discountAmount]);
  const subtotal = math.subtotal;
  const itbisTotal = math.itbis_total;
  const pvTotal = Math.round(items.reduce((s, i) => s + (Number(i.pv) || 0) * (Number(i.quantity) || 0), 0) * 100) / 100;

  async function handleSave() {
    if (!clientId) { toast.error("Selecciona un cliente"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        quote_date: quoteDate,
        valid_until: validUntil,
        status: (editingId ? editingStatus : "DRAFT") as "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "CONVERTED",
        subtotal,
        discount_amount: discountValue,
        itbis_total: itbisTotal,
        total: math.total,
        pv_total: pvTotal,
        notes: notes || undefined,
        margin,
        items: items.map((i, idx) => ({
          product_id: i.product_id || undefined,
          quantity: i.quantity,
          unit_price: effectivePrice(i),
          unit_cost: i.cost || 0,
          pv: i.pv || 0,
          itbis: i.itbis,
          itbis_amount: math.lines[idx]?.itbis_amount ?? 0,
        })),
      };
      if (editingId) {
        await updateQuote(editingId, payload);
        toast.success("Cotización actualizada");
      } else {
        await createQuote(payload);
        toast.success("Cotización creada");
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar cotización");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Estás segura de eliminar esta cotización?")) return;
    try {
      await deleteQuote(id);
      toast.success("Cotización eliminada");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  }

  async function handleStatus(id: string, status: "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED") {
    try {
      await updateQuoteStatus(id, status);
      const label = statusMap[status]?.label || status;
      toast.success(`Cotización marcada como ${label.toLowerCase()}`);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar estado");
    }
  }

  async function openDetail(quote: QuoteWithClient) {
    try {
      const { quote: full, items: qItems } = await getQuote(quote.id);
      setSelectedQuote(full);
      setDetailItems(qItems);
       const fl = await getFollowupsByQuote(quote.id).catch(() => []);
       setDetailFollowups(fl);
    } catch {
      toast.error("Error al cargar el detalle");
    }
  }

  async function handlePdf(quote: QuoteWithClient) {
    try {
      const { quote: full, items: qItems } = await getQuote(quote.id);
      await generateQuotePdf({
        quote_number: full.quote_number,
        quote_date: full.quote_date,
        valid_until: full.valid_until,
        status: full.status,
        client_name: full.clients?.full_name || "",
        client_phone: full.clients?.phone || undefined,
        client_email: full.clients?.email || undefined,
        items: qItems.map((i) => ({
          name: i.products?.name || i.custom_name || "Producto",
          quantity: Number(i.quantity) || 0,
          unit_price: Number(i.unit_price) || 0,
          line_total: Number(i.line_total) || 0,
          pv: Number(i.pv) || 0,
        })),
        subtotal: Number(full.subtotal) || 0,
        itbis_total: Number(full.itbis_total) || 0,
        discount_amount: Number(full.discount_amount) || 0,
        total: Number(full.total) || 0,
        pv_total: Number(full.pv_total) || 0,
        notes: full.notes || undefined,
        logo_url: settings?.logo_url || undefined,
        business_name: settings?.business_name || "Almaia RD",
        email: settings?.email || undefined,
        phone: settings?.phone || undefined,
      });
    } catch {
      toast.error("Error al generar el PDF");
    }
  }

  function convertToInvoice(quote: QuoteWithClient) {
    router.push(`/facturacion?nueva=true&quote=${quote.id}`);
  }

  const clientName = (q: QuoteWithClient) => q.clients?.full_name || "—";

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Cotizaciones</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Crea, envía y da seguimiento a tus cotizaciones</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm"
        >
          <Plus size={18} /> Nueva Cotización
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-11 px-3 rounded-xl border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all sm:w-44"
        >
          <option value="">Todos los estados</option>
          {Object.entries(statusMap).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="h-11 px-3 rounded-xl border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all sm:w-52"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Borradores", value: quotes.filter(q => q.status === "DRAFT").length, color: "text-[#9C8A82]" },
          { label: "Enviadas", value: quotes.filter(q => q.status === "SENT").length, color: "text-[#B8837E]" },
          { label: "Aceptadas", value: quotes.filter(q => q.status === "ACCEPTED").length, color: "text-[#86C7A3]" },
          { label: "Convertidas", value: quotes.filter(q => q.status === "CONVERTED").length, color: "text-[#5C3E35]" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#9C8A82] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#9C8A82]">Cargando cotizaciones...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={40} className="mx-auto text-[#E8E0D8] mb-3" />
            <p className="text-sm text-[#9C8A82]">No hay cotizaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF6F0] border-b border-[#E8E0D8]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Válida hasta</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">PV</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id} className="border-b border-[#E8E0D8] last:border-0 hover:bg-[#FAF6F0]/50 cursor-pointer transition-colors" onClick={() => openDetail(q)}>
                    <td className="px-4 py-3 font-semibold text-[#5C3E35]">{q.quote_number}</td>
                    <td className="px-4 py-3 text-[#5C3E35]">{clientName(q)}</td>
                    <td className="px-4 py-3 text-[#9C8A82]">{formatDate(q.quote_date)}</td>
                    <td className="px-4 py-3 text-[#9C8A82]">{formatDate(q.valid_until)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#5C3E35]">{formatCurrency(Number(q.total))}</td>
                    <td className="px-4 py-3 text-right text-[#9C8A82]">{Number(q.pv_total) || 0}</td>
                    <td className="px-4 py-3"><Badge variant={statusMap[q.status]?.variant || "neutral"}>{statusMap[q.status]?.label || q.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handlePdf(q)} className="p-2 text-[#B8837E] hover:bg-[#B8837E]/10 rounded-lg" title="PDF"><Printer size={15} /></button>
                        {(q.status === "DRAFT" || q.status === "SENT") && (
                          <button onClick={() => handleStatus(q.id, "SENT")} className="p-2 text-[#B8837E] hover:bg-[#B8837E]/10 rounded-lg" title="Marcar enviada"><Send size={15} /></button>
                        )}
                        {q.status === "SENT" && (
                          <button onClick={() => handleStatus(q.id, "ACCEPTED")} className="p-2 text-[#86C7A3] hover:bg-[#86C7A3]/10 rounded-lg" title="Aceptar"><CheckCircle2 size={15} /></button>
                        )}
                        {q.status === "SENT" && (
                          <button onClick={() => handleStatus(q.id, "REJECTED")} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg" title="Rechazar"><XCircle size={15} /></button>
                        )}
                        {(q.status === "DRAFT" || q.status === "SENT") && (
                          <button onClick={() => handleStatus(q.id, "CANCELLED")} className="p-2 text-[#9C8A82] hover:bg-[#9C8A82]/10 rounded-lg" title="Cancelar"><Ban size={15} /></button>
                        )}
                        {q.status === "ACCEPTED" && (
                          <button onClick={() => convertToInvoice(q)} className="p-2 text-[#86C7A3] hover:bg-[#86C7A3]/10 rounded-lg" title="Convertir en factura"><ArrowRightLeft size={15} /></button>
                        )}
                        {q.status !== "CONVERTED" && (
                          <button onClick={() => openEdit(q.id)} className="p-2 text-[#5C3E35] hover:bg-[#5C3E35]/10 rounded-lg" title="Editar"><Edit2 size={15} /></button>
                        )}
                        {user?.role === "admin" && q.status !== "CONVERTED" && (
                          <button onClick={() => handleDelete(q.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg" title="Eliminar"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Editar Cotización" : "Nueva Cotización"}
        subtitle={editingId ? "Actualiza los datos de la cotización" : "Genera una cotización para tu cliente"}
        wide
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cliente *</label>
              <div className="flex gap-2">
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex-1 h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="shrink-0 h-12 px-4 rounded-xl bg-[#B8837E]/10 text-[#B8837E] text-sm font-medium hover:bg-[#B8837E]/20 transition-all flex items-center gap-1.5"
                  title="Nuevo Cliente"
                >
                  <Plus size={16} /> Nuevo
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Válida hasta</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Margen</label>
              <select value={margin} onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
                <option value={30}>30%</option>
                <option value={35}>35%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descuento %</label>
              <input type="number" min={0} max={100} value={discountPercent}
                onChange={(e) => { setDiscountPercent(Number(e.target.value)); setDiscountAmount(0); }}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#5C3E35]">Productos</label>
              <div className="flex gap-3">
                <button onClick={() => { setShowProducts(!showProducts); setShowManualProduct(false); }} className="text-xs text-[#B8837E] hover:underline">
                  {showProducts ? "Ocultar catálogo" : "Catálogo"}
                </button>
                <button onClick={() => { setShowManualProduct(!showManualProduct); setShowProducts(false); }} className="text-xs text-[#B8837E] hover:underline">
                  {showManualProduct ? "Cancelar" : "Manual"}
                </button>
              </div>
            </div>

            {showProducts && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl overflow-hidden">
                <div className="p-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                    <input type="text" placeholder="Buscar producto..." value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" autoFocus />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-0.5">
                  {productFiltered.length === 0 ? (
                    <p className="text-sm text-[#9C8A82] py-3 text-center">Sin resultados</p>
                  ) : productFiltered.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm text-[#5C3E35] hover:bg-white rounded-lg transition-colors flex justify-between items-center gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{p.name}</span>
                        {p.is_bundle && <Badge variant="warning">BUNDLE</Badge>}
                      </span>
                      <span className="text-[#9C8A82] text-xs flex-shrink-0">
                        <span className={margin === 30 ? "font-semibold text-[#5C3E35]" : ""}>30%: {formatCurrency(p.price_30)}</span>
                        {" | "}
                        <span className={margin === 35 ? "font-semibold text-[#5C3E35]" : ""}>35%: {formatCurrency(p.price_35)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showManualProduct && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl p-4 space-y-3">
                <input type="text" value={manualProduct.name}
                  onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                  placeholder="Nombre del producto / costo" autoFocus
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5C3E35] mb-1">Cantidad</label>
                    <input type="number" min={1} value={manualProduct.quantity}
                      onChange={(e) => setManualProduct({ ...manualProduct, quantity: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5C3E35] mb-1">Precio Unit.</label>
                    <input type="number" step="0.01" min={0} value={manualProduct.unit_price}
                      onChange={(e) => setManualProduct({ ...manualProduct, unit_price: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5C3E35] mb-1">Costo (opcional)</label>
                    <input type="number" step="0.01" min={0} value={manualProduct.cost}
                      onChange={(e) => setManualProduct({ ...manualProduct, cost: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-medium text-[#5C3E35]">ITBIS</span>
                      <button type="button" onClick={() => setManualProduct({ ...manualProduct, itbis: !manualProduct.itbis })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${manualProduct.itbis ? "bg-[#B8837E]" : "bg-gray-300"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${manualProduct.itbis ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </label>
                    <button onClick={addManualProduct} className="ml-3 h-10 px-3 bg-[#B8837E] text-white text-xs rounded-lg hover:bg-[#9A6B66] transition-colors flex items-center gap-1">
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-[#E8E0D8] rounded-xl p-6 text-center">
                <p className="text-sm text-[#9C8A82]">Agrega productos desde el catálogo o manualmente</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E8E0D8] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FAF6F0] border-b border-[#E8E0D8]">
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Producto</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Cant.</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Precio Unit.</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">PV</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-b border-[#E8E0D8] last:border-0">
                          <td className="px-3 py-2 text-[#5C3E35]">{item.name}</td>
                          <td className="px-3 py-2 w-20">
                            <input type="number" min={0} value={item.quantity}
                              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                              className="w-full h-9 px-2 rounded-lg border border-[#E8E0D8] bg-[#FCFAF7] text-sm text-center text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                          </td>
                          <td className="px-3 py-2 w-28">
                            <input type="number" step="0.01" min={0} value={effectivePrice(item)}
                              onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                              className="w-full h-9 px-2 rounded-lg border border-[#E8E0D8] bg-[#FCFAF7] text-sm text-right text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                          </td>
                          <td className="px-3 py-2 w-20">
                            <input type="number" step="0.01" min={0} value={item.pv}
                              onChange={(e) => updateItem(i, { pv: Number(e.target.value) })}
                              className="w-full h-9 px-2 rounded-lg border border-[#E8E0D8] bg-[#FCFAF7] text-sm text-right text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-[#5C3E35]">
                            {formatCurrency((item.quantity || 0) * effectivePrice(item) + (math.lines[i]?.itbis_amount ?? 0))}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeItem(i)} className="p-1.5 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg"><X size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Condiciones, tiempos de entrega, observaciones..."
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none" />
          </div>

          <div className="flex justify-end gap-3 bg-[#FAF6F0] rounded-xl p-4">
            <div className="text-right mr-4">
              <p className="text-xs text-[#9C8A82]">Subtotal: <span className="text-[#5C3E35] font-medium">{formatCurrency(subtotal)}</span></p>
              <p className="text-xs text-[#9C8A82]">ITBIS (18%): <span className="text-[#5C3E35] font-medium">{formatCurrency(itbisTotal)}</span></p>
              {discountValue > 0 && <p className="text-xs text-[#D4A0A0]">Descuento: <span>-{formatCurrency(discountValue)}</span></p>}
              <p className="text-xs text-[#9C8A82]">PV Total: <span className="text-[#5C3E35] font-medium">{pvTotal}</span></p>
              <p className="text-sm font-bold text-[#5C3E35] mt-1">Total: {formatCurrency(math.total)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center justify-center gap-2 bg-[#B8837E] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">
                <Save size={16} /> {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar cotización"}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title={`Cotización ${selectedQuote?.quote_number || ""}`}
        subtitle={selectedQuote ? `${clientName(selectedQuote)} — ${statusMap[selectedQuote.status]?.label || selectedQuote.status}` : ""}
        wide
      >
        {selectedQuote && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#FAF6F0] rounded-xl p-3">
                <p className="text-xs text-[#9C8A82]">Fecha</p>
                <p className="text-sm font-semibold text-[#5C3E35]">{formatDate(selectedQuote.quote_date)}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3">
                <p className="text-xs text-[#9C8A82]">Válida hasta</p>
                <p className="text-sm font-semibold text-[#5C3E35]">{formatDate(selectedQuote.valid_until)}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3">
                <p className="text-xs text-[#9C8A82]">Total</p>
                <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(Number(selectedQuote.total))}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3">
                <p className="text-xs text-[#9C8A82]">PV Total</p>
                <p className="text-sm font-semibold text-[#5C3E35]">{Number(selectedQuote.pv_total) || 0}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#5C3E35] mb-2">Productos</p>
              <div className="bg-white rounded-xl border border-[#E8E0D8] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E8E0D8]">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Producto</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Cant.</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Precio</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((it, i) => (
                      <tr key={i} className="border-b border-[#E8E0D8] last:border-0">
                        <td className="px-3 py-2.5 text-[#5C3E35]">{it.products?.name || it.custom_name || "Producto"}</td>
                        <td className="px-3 py-2.5 text-right text-[#9C8A82]">{it.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-[#9C8A82]">{formatCurrency(Number(it.unit_price))}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#5C3E35]">{formatCurrency(Number(it.line_total) + Number(it.itbis_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs text-[#9C8A82]">Subtotal: <span className="text-[#5C3E35]">{formatCurrency(Number(selectedQuote.subtotal))}</span></p>
                <p className="text-xs text-[#9C8A82]">ITBIS: <span className="text-[#5C3E35]">{formatCurrency(Number(selectedQuote.itbis_total))}</span></p>
                {Number(selectedQuote.discount_amount) > 0 && <p className="text-xs text-[#D4A0A0]">Descuento: <span>-{formatCurrency(Number(selectedQuote.discount_amount))}</span></p>}
                <p className="text-sm font-bold text-[#5C3E35] mt-1">Total: {formatCurrency(Number(selectedQuote.total))}</p>
              </div>
            </div>

            {selectedQuote.notes && (
              <div className="bg-[#FAF6F0] rounded-xl p-3">
                <p className="text-xs text-[#9C8A82] mb-1">Notas</p>
                <p className="text-sm text-[#5C3E35]">{selectedQuote.notes}</p>
              </div>
            )}

            {detailFollowups.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#5C3E35] mb-2">Seguimientos programados</p>
                <div className="space-y-2">
                  {detailFollowups.map((f) => (
                    <div key={f.id} className="flex items-center justify-between bg-[#FAF6F0] rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm text-[#5C3E35]">{f.comments}</p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(f.contact_date)}</p>
                      </div>
                      <Badge variant={f.status === "COMPLETED" ? "success" : f.status === "OVERDUE" ? "danger" : "warning"}>{f.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E8E0D8]">
              <button onClick={() => handlePdf(selectedQuote)}
                className="flex items-center gap-2 bg-[#B8837E] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all">
                <Printer size={16} /> PDF
              </button>
              <button onClick={() => setDraftModal({ type: "email" })}
                className="flex items-center gap-2 border border-[#E8E0D8] text-[#5C3E35] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                <Mail size={16} /> Email
              </button>
              <button onClick={() => setDraftModal({ type: "whatsapp" })}
                className="flex items-center gap-2 border border-[#E8E0D8] text-[#5C3E35] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                <MessageCircle size={16} /> WhatsApp
              </button>
              {selectedQuote.status === "SENT" && (
                <button onClick={() => handleStatus(selectedQuote.id, "ACCEPTED")}
                  className="flex items-center gap-2 bg-[#86C7A3] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all">
                  <CheckCircle2 size={16} /> Aceptar
                </button>
              )}
              {selectedQuote.status === "SENT" && (
                <button onClick={() => handleStatus(selectedQuote.id, "REJECTED")}
                  className="flex items-center gap-2 border border-[#D4A0A0] text-[#D4A0A0] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#D4A0A0]/10 transition-all">
                  <XCircle size={16} /> Rechazar
                </button>
              )}
              {selectedQuote.status === "ACCEPTED" && (
                <button onClick={() => convertToInvoice(selectedQuote)}
                  className="flex items-center gap-2 bg-[#86C7A3] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all">
                  <ArrowRightLeft size={16} /> Convertir en factura
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {draftModal && selectedQuote && (
        <CommunicationDraftModal
          isOpen={true}
          onClose={() => setDraftModal(null)}
          type={draftModal.type}
          client={{
            id: selectedQuote.client_id,
            full_name: selectedQuote.clients?.full_name || "",
            email: selectedQuote.clients?.email,
            phone: selectedQuote.clients?.phone,
          }}
          documentType="quote"
          documentNumber={selectedQuote.quote_number}
          documentId={selectedQuote.id}
          total={formatCurrency(Number(selectedQuote.total))}
          businessName={settings?.business_name || "Almaia RD"}
          senderEmail={settings?.email || undefined}
          senderName={settings?.sender_name || undefined}
          emailTemplate={(settings as any)?.email_template || undefined}
          whatsappTemplate={(settings as any)?.whatsapp_template || undefined}
          smtp={(settings as any)?.smtp_host ? {
            host: (settings as any).smtp_host,
            port: (settings as any).smtp_port || 587,
            user: (settings as any).smtp_user,
            configured: !!(settings as any).has_smtp_password,
            secure: (settings as any).smtp_secure || false,
            senderName: (settings as any).sender_name || undefined,
          } : undefined}
          getAttachment={async () => {
            const { quote: full, items: qItems } = await getQuote(selectedQuote.id);
            const doc = await buildQuotePdfDoc({
              quote_number: full.quote_number,
              quote_date: full.quote_date,
              valid_until: full.valid_until,
              status: full.status,
              client_name: full.clients?.full_name || "",
              client_phone: full.clients?.phone || undefined,
              client_email: full.clients?.email || undefined,
              items: qItems.map((i) => ({
                name: i.products?.name || i.custom_name || "Producto",
                quantity: Number(i.quantity) || 0,
                unit_price: Number(i.unit_price) || 0,
                line_total: Number(i.line_total) || 0,
                pv: Number(i.pv) || 0,
              })),
              subtotal: Number(full.subtotal) || 0,
              itbis_total: Number(full.itbis_total) || 0,
              discount_amount: Number(full.discount_amount) || 0,
              total: Number(full.total) || 0,
              pv_total: Number(full.pv_total) || 0,
              notes: full.notes || undefined,
              logo_url: settings?.logo_url || undefined,
              business_name: settings?.business_name || "Almaia RD",
              email: settings?.email || undefined,
              phone: settings?.phone || undefined,
            });
            return { filename: `cotizacion-${full.quote_number}.pdf`, base64: doc.output("datauristring").split(",")[1] };
          }}
        />
      )}

      <ClientFormModal
        isOpen={showNewClient}
        onClose={() => setShowNewClient(false)}
        onSaved={handleSavedNewClient}
        title="Nuevo Cliente"
        subtitle="Registra la información del cliente"
        saveLabel="Agregar Cliente"
      />
    </PageContainer>
  );
}
