"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getInvoices, createInvoice, deleteInvoice, searchInvoices, getInvoice, updateInvoice, getBankAccounts } from "@/services/invoices";
import { getClients, createClient } from "@/services/clients";
import { getProducts } from "@/services/products";
import { getSettings } from "@/services/settings";
import type { Client, BankAccount, Settings } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf";
import { FileText, Plus, Search, Eye, Printer, Edit2, Trash2, X, Save, DollarSign, Download, ChevronDown, Flower2 } from "lucide-react";
import toast from "react-hot-toast";

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  PARTIAL: { label: "Parcial", variant: "info" },
  PAID: { label: "Pagada", variant: "success" },
  CANCELLED: { label: "Anulada", variant: "danger" },
};

export default function FacturacionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [margin, setMargin] = useState(30);
  const [items, setItems] = useState<Array<{ product_id: string; name: string; quantity: number; unit_price: number; pv: number; itbis: boolean }>>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [openPrintId, setOpenPrintId] = useState<string | null>(null);
  const [jpgData, setJpgData] = useState<any>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ full_name: "", phone: "", email: "", ibo_number: "", notes: "" });
  const [showManualProduct, setShowManualProduct] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: "", quantity: 1, unit_price: 0, itbis: true });
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const jpgRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef("");

  const productFiltered = products.filter(p => p.active && (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())));

  const load = useCallback(async (query: string) => {
    try {
      const [inv, cl, pr, ba, st] = await Promise.all([
        query ? searchInvoices(query) : getInvoices(),
        getClients(),
        getProducts(),
        getBankAccounts(),
        getSettings().catch(() => null),
      ]);
      setInvoices(inv);
      setClients(cl);
      setProducts(pr);
      setBankAccounts(ba);
      setSettings(st);
    } catch {
      toast.error("Error al cargar facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(searchRef.current); }, [load]);

  useEffect(() => {
    if (settings?.default_margin) setMargin(settings.default_margin);
  }, [settings]);

  useEffect(() => {
    if (searchParams.get("nueva") === "true") {
      resetForm();
      setShowModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      load(searchRef.current);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, load]);

  function handleSearch(val: string) {
    searchRef.current = val;
    setSearchQuery(val);
  }

  async function handleSaveNewClient() {
    if (!newClientForm.full_name.trim()) { toast.error("El nombre del cliente es requerido"); return; }
    setSaving(true);
    try {
      const created = await createClient(newClientForm);
      const fresh = await getClients();
      setClients(fresh);
      setSelectedClient(created.id);
      setShowNewClient(false);
      setNewClientForm({ full_name: "", phone: "", email: "", ibo_number: "", notes: "" });
      toast.success("Cliente agregado");
    } catch (e) {
      console.error("Error creating client:", e);
      toast.error(`Error: ${(e as any)?.message || "Error al crear cliente"}`);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedClient("");
    setItems([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setMargin(30);
    setNotes("");
    setBankAccountId("");
    setEditingId(null);
  }

  function addProduct(product: any) {
    const isNutrilite = product.subbrands?.name === "Nutrilite";
    const defaultItbis = isNutrilite ? Boolean(settings?.nutrilite_itbis_enabled) : true;
    setItems([...items, {
      product_id: product.id,
      name: product.name,
      quantity: 1,
      unit_price: margin === 30 ? product.price_30 : product.price_35,
      pv: product.pv,
      itbis: defaultItbis,
    }]);
  }

  function addManualProduct() {
    if (!manualProduct.name.trim()) { toast.error("El nombre del producto es requerido"); return; }
    if (manualProduct.unit_price <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    setItems([...items, {
      product_id: "",
      name: manualProduct.name,
      quantity: manualProduct.quantity,
      unit_price: manualProduct.unit_price,
      pv: 0,
      itbis: manualProduct.itbis,
    }]);
    setManualProduct({ name: "", quantity: 1, unit_price: 0, itbis: true });
    setShowManualProduct(false);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const itbisTotal = items.reduce((s, i) => s + (i.itbis ? i.quantity * i.unit_price * 0.18 : 0), 0);
  const discountValue = discountAmount > 0 ? discountAmount : (subtotal * discountPercent / 100);
  const total = subtotal + itbisTotal - discountValue;

  async function handlePrintPdf(inv: any) {
    try {
      const full = await getInvoice(inv.id);
      const marginVal = full.margin || 30;
      await generateInvoicePdf({
        invoice_number: full.invoice_number,
        invoice_date: formatDate(full.invoice_date),
        client_name: full.clients?.full_name || "Cliente",
        client_phone: full.clients?.phone,
        client_email: full.clients?.email,
        client_id_number: full.clients?.id_number,
          items: full.invoice_items?.map((item: any) => ({
            subbrand: item.products?.subbrands?.name || "—",
            name: item.products?.name || item.custom_name || "Producto",
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            line_total: Number(item.line_total),
          })) || [],
        subtotal: Number(full.subtotal),
        itbis_total: Number(full.itbis_total || 0),
        discount_amount: Number(full.discount_amount),
        total: Number(full.total),
        paid_amount: Number(full.amount_paid || 0),
        balance_due: Number(full.balance_due || 0),
        bank_account: full.bank_accounts ? {
          holder_name: full.bank_accounts.holder_name,
          bank_name: full.bank_accounts.bank_name,
          account_type: full.bank_accounts.account_type,
          account_number: full.bank_accounts.account_number,
        } : undefined,
        logo_url: settings?.logo_url,
        signature_url: settings?.signature_url,
        business_name: settings?.business_name,
        email: settings?.email,
        phone: settings?.phone,
      });
    } catch {
      toast.error("Error al generar PDF");
    }
    setOpenPrintId(null);
  }

  async function handlePrintJpg(inv: any) {
    try {
      const full = await getInvoice(inv.id);
      setJpgData(full);
      await new Promise(r => setTimeout(r, 100));
      const html2canvas = (await import("html2canvas")).default;
      let el = jpgRef.current;
      let retries = 0;
      while (!el && retries < 10) {
        await new Promise(r => setTimeout(r, 200));
        el = jpgRef.current;
        retries++;
      }
      if (!el) { toast.error("Vista previa no disponible"); setJpgData(null); return; }
      el.style.display = "block";
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      el.style.display = "none";
      const link = document.createElement("a");
      link.download = `factura-${inv.invoice_number}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      setJpgData(null);
      toast.success("JPG descargado");
    } catch {
      toast.error("Error al generar JPG");
    }
    setOpenPrintId(null);
  }

  async function handleViewDetail(inv: any) {
    try {
      const full = await getInvoice(inv.id);
      setSelectedInvoice(full);
      setShowDetail(true);
    } catch {
      setSelectedInvoice(inv);
      setShowDetail(true);
    }
  }

  async function handleEdit(inv: any) {
    try {
      const full = await getInvoice(inv.id);
      setEditingId(full.id);
      setSelectedClient(full.client_id);
      setItems(full.invoice_items?.map((item: any) => ({
        product_id: item.product_id,
        name: item.products?.name || "Producto",
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        pv: Number(item.pv || 0),
        itbis: item.itbis ?? true,
      })) || []);
      setDiscountPercent(0);
      setDiscountAmount(Number(full.discount_amount));
      setNotes(full.notes || "");
      setBankAccountId(full.bank_account_id || "");
      setMargin(full.margin || 30);
      setShowModal(true);
    } catch {
      toast.error("Error al cargar factura");
    }
  }

  async function handleSave() {
    if (!selectedClient) { toast.error("Selecciona un cliente"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: selectedClient,
        discount_amount: discountValue,
        status: "PENDING" as const,
        margin,
        notes: notes || undefined,
        bank_account_id: bankAccountId || undefined,
      };
      const invoiceItems = items.map((i) => ({
        product_id: i.product_id || undefined,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.quantity * i.unit_price,
        pv: i.pv * i.quantity,
        unit_cost: 0,
        itbis: i.itbis,
        custom_name: i.product_id ? undefined : i.name,
      }));

      if (editingId) {
        await updateInvoice(editingId, payload, invoiceItems);
        toast.success("Factura actualizada");
      } else {
        await createInvoice(payload, invoiceItems);
        toast.success("Factura creada exitosamente");
      }
      setShowModal(false);
      resetForm();
      await load(searchRef.current);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar factura");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Estás segura de eliminar esta factura?")) return;
    try {
      await deleteInvoice(id);
      toast.success("Factura eliminada");
      await load(searchRef.current);
    } catch {
      toast.error("Error al eliminar factura");
    }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Facturación</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Gestión de facturas y ventas</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm"
        >
          <Plus size={18} />
          Nueva Factura
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar factura por número o cliente..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
        />
      </div>

      <div className="flex gap-3 mb-6">
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
          <option value="">Todos los meses</option>
          {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
          <option value="">Todos los años</option>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {(filterMonth || filterYear) && (
          <button onClick={() => { setFilterMonth(""); setFilterYear(""); }} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3">Limpiar filtros</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay facturas registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">No. Factura</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Cliente</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices
                .filter((inv: any) => {
                  if (filterMonth || filterYear) {
                    const d = new Date(inv.invoice_date);
                    if (filterMonth && String(d.getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
                    if (filterYear && String(d.getFullYear()) !== filterYear) return false;
                  }
                  return true;
                })
                .map((inv: any) => {
                const s = statusMap[inv.status] || statusMap.PENDING;
                return (
                  <tr key={inv.id} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow">
                    <td className="px-4 py-3.5 text-sm font-medium text-[#5C3E35]">{inv.invoice_number}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35]">{inv.clients?.full_name || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3.5 text-center"><Badge variant={s.variant}>{s.label}</Badge></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1 relative">
                        <button onClick={() => handleViewDetail(inv)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="Ver"><Eye size={15} /></button>
                        <div className="relative">
                          <button
                            onClick={() => setOpenPrintId(openPrintId === inv.id ? null : inv.id)}
                            className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg"
                            title="Descargar"
                          >
                            <Download size={15} />
                          </button>
                          {openPrintId === inv.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenPrintId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-1 min-w-[130px]">
                                <button onClick={() => handlePrintPdf(inv)} className="w-full text-left px-4 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0] flex items-center gap-2">
                                  <FileText size={14} /> PDF
                                </button>
                                <button onClick={() => handlePrintJpg(inv)} className="w-full text-left px-4 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0] flex items-center gap-2">
                                  <Download size={14} /> JPG
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <button onClick={() => handleEdit(inv)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="Editar"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(inv.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg" title="Eliminar"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedInvoice(null); }} title={selectedInvoice?.invoice_number || "Detalle"} wide>
        {selectedInvoice && (
          <div className="space-y-5">
            <div id="invoice-preview" className="bg-white p-8 rounded-xl" style={{ fontFamily: "system-ui, sans-serif" }}>
              {/* A. HEADER */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-start gap-2">
                  <Flower2 size={24} className="text-[#B8837E] mt-1" />
                  <div>
                    <h2 className="text-2xl font-bold text-[#5C3E35]">{settings?.business_name || "ALMAIA"}</h2>
                    <p className="text-xs tracking-widest text-[#B8837E] uppercase mt-0.5">Bienestar & Salud</p>
                    <p className="text-sm font-bold text-[#5C3E35] mt-2">Distribuidor Independiente Amway</p>
                    <p className="text-xs text-[#9C8A82] mt-0.5">Suplementos, cosmética y bienestar para toda la familia</p>
                    <p className="text-xs text-[#9C8A82]">República Dominicana</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-[#F0EBE3] text-[#B8837E] text-xs font-bold px-4 py-2 rounded-full">FACTURA DE VENTA</span>
                  <p className="text-lg font-bold text-[#5C3E35] mt-3">{selectedInvoice.invoice_number}</p>
                  <p className="text-xs text-[#9C8A82] mt-0.5">Fecha: {formatDate(selectedInvoice.invoice_date)}</p>
                  <div className="mt-2">
                    <Badge variant={(statusMap[selectedInvoice.status] || statusMap.PENDING).variant}>
                      {(statusMap[selectedInvoice.status] || statusMap.PENDING).label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E8E0D8] mb-5" />

              {/* B. CLIENTE / ADQUIRIENTE */}
              <div className="border border-[#E8E0D8] bg-[#FCFAF7] rounded-xl p-4 mb-5">
                <p className="text-xs font-bold text-[#B8837E] mb-3">CLIENTE / ADQUIRIENTE</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Nombre:</span> {selectedInvoice.clients?.full_name}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Teléfono:</span> {selectedInvoice.clients?.phone || "—"}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Email:</span> {selectedInvoice.clients?.email || "N/D"}</p>
                  {selectedInvoice.clients?.id_number && (
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cédula:</span> {selectedInvoice.clients.id_number}</p>
                  )}
                </div>
              </div>

              {/* C. PRODUCTS TABLE */}
              <table className="w-full text-sm mb-5">
                <thead>
                  <tr className="bg-[#F0EBE3]">
                    <th className="py-2.5 px-3 text-left text-xs text-[#5C3E35] font-bold">Submarca</th>
                    <th className="py-2.5 px-3 text-left text-xs text-[#5C3E35] font-bold">Descripción / Producto</th>
                    <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Cant.</th>
                    <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.invoice_items || []).map((item: any, i: number) => {
                    return (
                      <tr key={i} className="border-b border-[#F0EBE3]">
                        <td className="py-2.5 px-3 text-xs text-[#9C8A82]">{item.products?.subbrands?.name || "—"}</td>
                        <td className="py-2.5 px-3 text-sm text-[#5C3E35]">{item.products?.name || item.custom_name || "Producto"}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="py-2.5 px-3 text-right text-sm font-medium text-[#5C3E35]">{formatCurrency(Number(item.line_total))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* D. PAYMENT DATA */}
              {selectedInvoice.bank_accounts && (
                <div className="border border-[#E8E0D8] bg-[#FCFAF7] rounded-xl p-4 mb-5">
                  <p className="text-xs font-bold text-[#B8837E] mb-3">DATOS DE PAGO POR TRANSFERENCIA</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Beneficiario:</span> {selectedInvoice.bank_accounts.holder_name}</p>
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Banco:</span> {selectedInvoice.bank_accounts.bank_name}</p>
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Tipo de Cuenta:</span> {selectedInvoice.bank_accounts.account_type}</p>
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">No. de Cuenta:</span> {selectedInvoice.bank_accounts.account_number}</p>
                  </div>
                </div>
              )}

              {/* E. SUMMARY */}
              <div className="border-t border-[#E8E0D8] pt-3 mb-5">
                <div className="flex justify-between text-sm text-[#9C8A82] mb-1">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(selectedInvoice.subtotal))}</span>
                </div>
                {Number(selectedInvoice.itbis_total) > 0 && (
                  <div className="flex justify-between text-sm text-[#9C8A82] mb-1">
                    <span>ITBIS (18%)</span>
                    <span>{formatCurrency(Number(selectedInvoice.itbis_total))}</span>
                  </div>
                )}
                {Number(selectedInvoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-[#D4A0A0] mb-1">
                    <span>Descuento</span>
                    <span>-{formatCurrency(Number(selectedInvoice.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-[#5C3E35] pt-1 border-t border-[#E8E0D8] mb-1">
                  <span>Total General</span>
                  <span>{formatCurrency(Number(selectedInvoice.total))}</span>
                </div>
                {Number(selectedInvoice.amount_paid) > 0 && (
                  <div className="flex justify-between text-sm text-[#86C7A3] mb-1">
                    <span>Monto Cobrado</span>
                    <span>{formatCurrency(Number(selectedInvoice.amount_paid))}</span>
                  </div>
                )}
                {(Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid || 0)) > 0 && (
                  <div className="flex justify-between text-sm font-bold text-[#B8837E]">
                    <span>Saldo Pendiente</span>
                    <span>{formatCurrency(Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid || 0))}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="bg-[#FFF8F0] border border-[#E8E0D8] rounded-xl p-3 mb-5">
                  <p className="text-xs text-[#9C8A82] mb-1">Notas:</p>
                  <p className="text-sm text-[#5C3E35]">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* F. FOOTER */}
              <div className="border-t border-[#E8E0D8] pt-4 flex justify-between items-end">
                <div>
                  <p className="text-xs italic text-[#B8837E]">¡Gracias por tu compra y por apoyar a {settings?.business_name || "Almaia RD"}, aliados a tu bienestar!</p>
                  <p className="text-xs text-[#9C8A82] mt-1.5">Nutrilite · Artistry · Glister · G&H · Satinique · Amway Home</p>
                </div>
                <div className="text-right">
                  {settings?.signature_url ? (
                    <img src={settings.signature_url} alt="Firma" className="h-24 ml-auto" />
                  ) : (
                    <p className="text-base italic text-[#5C3E35] font-light" style={{ fontFamily: "Georgia, serif" }}>{settings?.business_name || "ALMAIA"}</p>
                  )}
                  <p className="text-[9px] text-[#9C8A82] mt-0.5">FIRMA AUTORIZADA</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handlePrintPdf(selectedInvoice)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <FileText size={18} /> Descargar PDF
              </button>
              <button onClick={() => handlePrintJpg(selectedInvoice)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={18} /> Descargar JPG
              </button>
              {(selectedInvoice.status === "PENDING" || selectedInvoice.status === "PARTIAL") && (
                <button onClick={() => { setShowDetail(false); setSelectedInvoice(null); router.push(`/recibos?nuevo=true&invoice_id=${selectedInvoice.id}`); }} className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all flex items-center justify-center gap-2">
                  <DollarSign size={18} /> Registrar Pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? "Editar Factura" : "Nueva Factura"} wide>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cliente</label>
              <div className="flex gap-2">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="flex-1 h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                <button
                  onClick={() => setShowNewClient(true)}
                  className="h-12 px-4 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all flex items-center gap-1.5"
                >
                  <Plus size={16} /> Cliente
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Margen</label>
              <select
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              >
                <option value={30}>30%</option>
                <option value={35}>35%</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#5C3E35]">Productos</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowProducts(!showProducts); setShowManualProduct(false); }}
                  className="text-xs text-[#B8837E] hover:underline"
                >
                  {showProducts ? "Ocultar catálogo" : "Catálogo"}
                </button>
                <button
                  onClick={() => { setShowManualProduct(!showManualProduct); setShowProducts(false); }}
                  className="text-xs text-[#B8837E] hover:underline"
                >
                  {showManualProduct ? "Cancelar" : "Manual"}
                </button>
              </div>
            </div>

            {showProducts && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl overflow-hidden">
                <div className="p-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-0.5">
                  {productFiltered.length === 0 ? (
                    <p className="text-sm text-[#9C8A82] py-3 text-center">Sin resultados</p>
                  ) : productFiltered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { addProduct(p); setShowProducts(false); setProductSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm text-[#5C3E35] hover:bg-white rounded-lg transition-colors flex justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-[#9C8A82]">{formatCurrency(margin === 30 ? p.price_30 : p.price_35)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showManualProduct && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C3E35] mb-1">Nombre del producto / costo</label>
                  <input
                    type="text"
                    value={manualProduct.name}
                    onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                    placeholder="Ej: Envío, flete, cargo adicional..."
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5C3E35] mb-1">Cantidad</label>
                    <input
                      type="number" min={1} value={manualProduct.quantity}
                      onChange={(e) => setManualProduct({ ...manualProduct, quantity: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5C3E35] mb-1">Precio Unit.</label>
                    <input
                      type="number" step="0.01" min={0} value={manualProduct.unit_price}
                      onChange={(e) => setManualProduct({ ...manualProduct, unit_price: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-medium text-[#5C3E35]">ITBIS</span>
                      <button
                        type="button"
                        onClick={() => setManualProduct({ ...manualProduct, itbis: !manualProduct.itbis })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${manualProduct.itbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${manualProduct.itbis ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowManualProduct(false); setManualProduct({ name: "", quantity: 1, unit_price: 0, itbis: true }); }}
                    className="flex-1 h-9 border border-[#E8E0D8] text-[#5C3E35] rounded-lg text-xs font-medium hover:bg-white transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addManualProduct}
                    className="flex-1 h-9 bg-[#B8837E] text-white rounded-lg text-xs font-medium hover:bg-[#9A6B66] transition-all"
                  >
                    Agregar a factura
                  </button>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-[#9C8A82] py-3">No hay productos agregados</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#FAF6F0] rounded-xl p-3">
                    <div className="flex-1 text-sm text-[#5C3E35]">{item.name}</div>
                    <input
                      type="number" min={1} value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[i].quantity = Number(e.target.value);
                        setItems(newItems);
                      }}
                      className="w-16 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                    />
                    <input
                      type="number" step="0.01" value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[i].unit_price = Number(e.target.value);
                        setItems(newItems);
                      }}
                      className="w-24 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = [...items];
                        newItems[i].itbis = !newItems[i].itbis;
                        setItems(newItems);
                      }}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${item.itbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${item.itbis ? "translate-x-6" : "translate-x-0.5"}`} />
                    </button>
                    <span className={`text-sm font-medium w-20 text-right ${item.itbis ? "text-[#5C3E35]" : "text-[#9C8A82]"}`}>
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                    <button onClick={() => removeItem(i)} className="p-1 text-[#D4A0A0] hover:bg-white rounded-lg">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descuento %</label>
              <input
                type="number" value={discountPercent}
                onChange={(e) => { setDiscountPercent(Number(e.target.value)); setDiscountAmount(0); }}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descuento RD$</label>
              <input
                type="number" value={discountAmount}
                onChange={(e) => { setDiscountAmount(Number(e.target.value)); setDiscountPercent(0); }}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales para la factura..."
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm placeholder:text-[#BFB0A8] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Banco para transferencia</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            >
              <option value="">Seleccionar banco...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.account_type} — No. {b.account_number}</option>
              ))}
            </select>
          </div>

          <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[#9C8A82]">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {itbisTotal > 0 && (
              <div className="flex justify-between"><span className="text-[#9C8A82]">ITBIS (18%)</span><span>{formatCurrency(itbisTotal)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-[#9C8A82]">Descuento</span><span className="text-[#D4A0A0]">-{formatCurrency(discountValue)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[#E8E0D8]"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowModal(false); resetForm(); }}
              className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {saving ? "Guardando..." : (editingId ? "Actualizar Factura" : "Guardar Factura")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick-create client modal */}
      <Modal isOpen={showNewClient} onClose={() => { setShowNewClient(false); setNewClientForm({ full_name: "", phone: "", email: "", ibo_number: "", notes: "" }); }} title="Nuevo Cliente" subtitle="Registra un cliente rápido">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre completo *</label>
            <input type="text" value={newClientForm.full_name} onChange={(e) => setNewClientForm({ ...newClientForm, full_name: e.target.value })} placeholder="Nombre y apellidos" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Teléfono</label>
              <input type="text" value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} placeholder="809-000-0000" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Correo electrónico</label>
              <input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} placeholder="correo@ejemplo.com" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Número IBO (opcional)</label>
            <input type="text" value={newClientForm.ibo_number} onChange={(e) => setNewClientForm({ ...newClientForm, ibo_number: e.target.value })} placeholder="IBO" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowNewClient(false); setNewClientForm({ full_name: "", phone: "", email: "", ibo_number: "", notes: "" }); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSaveNewClient} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Agregar Cliente"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Hidden preview for JPG capture */}
      <div ref={jpgRef} style={{ display: "none", position: "fixed", top: 0, left: 0, zIndex: 9999, background: "#ffffff", width: "800px" }}>
        {jpgData && (
          <div id="invoice-preview" className="bg-white p-8" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start gap-2">
                <Flower2 size={24} className="text-[#B8837E] mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-[#5C3E35]">{settings?.business_name || "ALMAIA"}</h2>
                  <p className="text-xs tracking-widest text-[#B8837E] uppercase mt-0.5">Bienestar & Salud</p>
                  <p className="text-sm font-bold text-[#5C3E35] mt-2">Distribuidor Independiente Amway</p>
                  <p className="text-xs text-[#9C8A82] mt-0.5">Suplementos, cosmética y bienestar para toda la familia</p>
                  <p className="text-xs text-[#9C8A82]">República Dominicana</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-[#F0EBE3] text-[#B8837E] text-xs font-bold px-4 py-2 rounded-full">FACTURA DE VENTA</span>
                <p className="text-lg font-bold text-[#5C3E35] mt-3">{jpgData.invoice_number}</p>
                <p className="text-xs text-[#9C8A82] mt-0.5">Fecha: {formatDate(jpgData.invoice_date)}</p>
              </div>
            </div>
            <div className="border-t border-[#E8E0D8] mb-5" />
            <div className="border border-[#E8E0D8] bg-[#FCFAF7] rounded-xl p-4 mb-5">
              <p className="text-xs font-bold text-[#B8837E] mb-3">CLIENTE / ADQUIRIENTE</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Nombre:</span> {jpgData.clients?.full_name}</p>
                <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Teléfono:</span> {jpgData.clients?.phone || "—"}</p>
                <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Email:</span> {jpgData.clients?.email || "N/D"}</p>
              </div>
            </div>
            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="bg-[#F0EBE3]">
                  <th className="py-2.5 px-3 text-left text-xs text-[#5C3E35] font-bold">Submarca</th>
                  <th className="py-2.5 px-3 text-left text-xs text-[#5C3E35] font-bold">Descripción / Producto</th>
                  <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Cant.</th>
                  <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                  {(jpgData.invoice_items || []).map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#F0EBE3]">
                      <td className="py-2.5 px-3 text-xs text-[#9C8A82]">{item.products?.subbrands?.name || "—"}</td>
                      <td className="py-2.5 px-3 text-sm text-[#5C3E35]">{item.products?.name || item.custom_name || "Producto"}</td>
                      <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-medium text-[#5C3E35]">{formatCurrency(Number(item.line_total))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {jpgData.bank_accounts && (
              <div className="border border-[#E8E0D8] bg-[#FCFAF7] rounded-xl p-4 mb-5">
                <p className="text-xs font-bold text-[#B8837E] mb-3">DATOS DE PAGO POR TRANSFERENCIA</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Beneficiario:</span> {jpgData.bank_accounts.holder_name}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Banco:</span> {jpgData.bank_accounts.bank_name}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Tipo de Cuenta:</span> {jpgData.bank_accounts.account_type}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">No. de Cuenta:</span> {jpgData.bank_accounts.account_number}</p>
                </div>
              </div>
            )}
            <div className="border-t border-[#E8E0D8] pt-3 mb-5">
              <div className="flex justify-between text-sm text-[#9C8A82] mb-1">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(jpgData.subtotal))}</span>
              </div>
              {Number(jpgData.itbis_total) > 0 && (
                <div className="flex justify-between text-sm text-[#9C8A82] mb-1">
                  <span>ITBIS (18%)</span>
                  <span>{formatCurrency(Number(jpgData.itbis_total))}</span>
                </div>
              )}
              {Number(jpgData.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-[#D4A0A0] mb-1">
                  <span>Descuento</span>
                  <span>-{formatCurrency(Number(jpgData.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#5C3E35] pt-1 border-t border-[#E8E0D8] mb-1">
                <span>Total General</span>
                <span>{formatCurrency(Number(jpgData.total))}</span>
              </div>
              {Number(jpgData.amount_paid) > 0 && (
                <div className="flex justify-between text-sm text-[#86C7A3] mb-1">
                  <span>Monto Cobrado</span>
                  <span>{formatCurrency(Number(jpgData.amount_paid))}</span>
                </div>
              )}
              {(Number(jpgData.total) - Number(jpgData.amount_paid || 0)) > 0 && (
                <div className="flex justify-between text-sm font-bold text-[#B8837E]">
                  <span>Saldo Pendiente</span>
                  <span>{formatCurrency(Number(jpgData.total) - Number(jpgData.amount_paid || 0))}</span>
                </div>
              )}
            </div>
            <div className="border-t border-[#E8E0D8] pt-4 flex justify-between items-end">
              <div>
                <p className="text-xs italic text-[#B8837E]">¡Gracias por tu compra y por apoyar a {settings?.business_name || "Almaia RD"}, aliados a tu bienestar!</p>
                <p className="text-xs text-[#9C8A82] mt-1.5">Nutrilite · Artistry · Glister · G&H · Satinique · Amway Home</p>
              </div>
              <div className="text-right">
                {settings?.signature_url ? (
                  <img src={settings.signature_url} alt="Firma" className="h-24 ml-auto" />
                ) : (
                  <p className="text-base italic text-[#5C3E35] font-light" style={{ fontFamily: "Georgia, serif" }}>{settings?.business_name || "ALMAIA"}</p>
                )}
                <p className="text-[9px] text-[#9C8A82] mt-0.5">FIRMA AUTORIZADA</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
