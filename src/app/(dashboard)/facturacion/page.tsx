"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getInvoices, createInvoice, deleteInvoice, searchInvoices, getInvoice, updateInvoice, getBankAccounts } from "@/services/invoices";
import { normalize } from "@/lib/search";
import CommunicationDraftModal from "@/components/communications/CommunicationDraftModal";
import { getClients, createClient } from "@/services/clients";
import { getProducts } from "@/services/products";
import { getSettings } from "@/services/settings";
import type { Client, BankAccount, Settings } from "@/types/database";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import { FileText, Plus, Search, Eye, Printer, Edit2, Trash2, X, Save, DollarSign, Download, ChevronDown, Flower2, Mail, MessageCircle } from "lucide-react";
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
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());
  const [margin, setMargin] = useState(30);
  const [items, setItems] = useState<Array<{ product_id: string; name: string; quantity: number; unit_price: number; price_30?: number; price_35?: number; pv: number; itbis: boolean }>>([]);
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
  const [draftModal, setDraftModal] = useState<{ type: "email" | "whatsapp" } | null>(null);
  const [showManualProduct, setShowManualProduct] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: "", quantity: 1, unit_price: 0, itbis: false });
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const jpgRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef("");

  const productFiltered = products.filter(p => p.active && (!productSearch || normalize(p.name).includes(normalize(productSearch))));

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

  function effectivePrice(item: { unit_price: number; price_30?: number; price_35?: number }) {
    if (item.price_30 != null && item.price_35 != null) {
      return margin === 30 ? item.price_30 : item.price_35;
    }
    return item.unit_price;
  }

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
    setInvoiceDate(getLocalDateString());
    setNotes("");
    setBankAccountId("");
    setEditingId(null);
  }

  function addProduct(product: any) {
    const price_30_ = product.price_30 ?? 0;
    const price_35_ = product.price_35 ?? 0;
    setItems([...items, {
      product_id: product.id,
      name: product.name,
      quantity: 1,
      unit_price: margin === 30 ? price_30_ : price_35_,
      price_30: price_30_,
      price_35: price_35_,
      pv: product.pv,
      itbis: product.apply_itbis !== false,
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
    setManualProduct({ name: "", quantity: 1, unit_price: 0, itbis: false });
    setShowManualProduct(false);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * effectivePrice(i), 0);
  const itbisTotal = items.reduce((s, i) => s + (i.itbis ? i.quantity * effectivePrice(i) * 0.18 : 0), 0);
  const discountValue = discountAmount > 0 ? discountAmount : (subtotal * discountPercent / 100);
  const total = subtotal + itbisTotal - discountValue;

  async function buildPreviewEl(data: any, settings: any) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:0;left:0;z-index:9999;background:#fff;width:800px;padding:32px;font-family:system-ui,sans-serif;font-size:16px;";
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(184,131,126,0.1);display:flex;align-items:center;justify-content:center;margin-top:4px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8837E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/></svg>
          </div>
          <div>
            <h2 style="font-size:24px;font-weight:700;color:#5C3E35;margin:0;">${settings?.business_name || "ALMAIA"}</h2>
            <p style="font-size:12px;letter-spacing:0.1em;color:#B8837E;text-transform:uppercase;margin:2px 0 0;">Bienestar & Salud</p>
            <p style="font-size:14px;font-weight:700;color:#5C3E35;margin:8px 0 0;">Distribuidor Independiente Amway</p>
            <p style="font-size:12px;color:#9C8A82;margin:2px 0 0;">Suplementos, cosmética y bienestar para toda la familia</p>
            <p style="font-size:12px;color:#9C8A82;margin:0;">Rep\u00fablica Dominicana</p>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;background:#F0EBE3;color:#B8837E;font-size:12px;font-weight:700;padding:8px 16px;border-radius:999px;white-space:nowrap;">FACTURA DE VENTA</span>
          <p style="font-size:18px;font-weight:700;color:#5C3E35;margin:12px 0 0;">${data.invoice_number}</p>
          <p style="font-size:12px;color:#9C8A82;margin:2px 0 0;">Fecha: ${formatDate(data.invoice_date)}</p>
        </div>
      </div>
      <div style="border-top:1px solid #E8E0D8;margin-bottom:20px;"></div>
      <div style="border:1px solid #E8E0D8;background:#FCFAF7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="font-size:11px;font-weight:700;color:#B8837E;margin:0 0 12px;">CLIENTE / ADQUIRIENTE</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;">
          <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Nombre:</span> ${data.clients?.full_name || ""}</p>
          <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Tel\u00e9fono:</span> ${data.clients?.phone || "\u2014"}</p>
          <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Email:</span> ${data.clients?.email || "N/D"}</p>
        </div>
      </div>
      <table style="width:100%;font-size:13px;margin-bottom:20px;border-collapse:collapse;">
        <thead>
          <tr style="background:#F0EBE3;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5C3E35;font-weight:700;">Submarca</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5C3E35;font-weight:700;">Descripci\u00f3n / Producto</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Cant.</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Precio Unit.</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(data.invoice_items || []).map((item: any) => `
            <tr style="border-bottom:1px solid #F0EBE3;">
              <td style="padding:10px 12px;font-size:11px;color:#9C8A82;">${item.products?.subbrands?.name || "\u2014"}</td>
              <td style="padding:10px 12px;font-size:13px;color:#5C3E35;">${item.products?.name || item.custom_name || "Producto"}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;color:#5C3E35;">${item.quantity}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;color:#5C3E35;">${formatCurrency(Number(item.unit_price))}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:500;color:#5C3E35;">${formatCurrency(Number(item.line_total))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${data.bank_accounts ? `
        <div style="border:1px solid #E8E0D8;background:#FCFAF7;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="font-size:11px;font-weight:700;color:#B8837E;margin:0 0 12px;">DATOS DE PAGO POR TRANSFERENCIA</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;">
            <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Beneficiario:</span> ${data.bank_accounts.holder_name}</p>
            ${data.bank_accounts.id_number ? `<p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">C\u00e9dula/RNC:</span> ${data.bank_accounts.id_number}</p>` : ""}
            <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Banco:</span> ${data.bank_accounts.bank_name}</p>
            <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Tipo de Cuenta:</span> ${data.bank_accounts.account_type}</p>
            <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">No. de Cuenta:</span> ${data.bank_accounts.account_number}</p>
            ${data.bank_accounts.email ? `<p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Correo:</span> ${data.bank_accounts.email}</p>` : ""}
          </div>
        </div>
      ` : ""}
      <div style="border-top:1px solid #E8E0D8;padding-top:12px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#9C8A82;margin-bottom:4px;">
          <span>Subtotal</span>
          <span>${formatCurrency(Number(data.subtotal))}</span>
        </div>
        ${Number(data.itbis_total) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#9C8A82;margin-bottom:4px;">
            <span>ITBIS (18%)</span>
            <span>${formatCurrency(Number(data.itbis_total))}</span>
          </div>
        ` : ""}
        ${Number(data.discount_amount) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#D4A0A0;margin-bottom:4px;">
            <span>Descuento</span>
            <span>-${formatCurrency(Number(data.discount_amount))}</span>
          </div>
        ` : ""}
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#5C3E35;padding-top:4px;border-top:1px solid #E8E0D8;margin-bottom:4px;">
          <span>Total General</span>
          <span>${formatCurrency(Number(data.total))}</span>
        </div>
        ${Number(data.amount_paid) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#86C7A3;margin-bottom:4px;">
            <span>Monto Cobrado</span>
            <span>${formatCurrency(Number(data.amount_paid))}</span>
          </div>
        ` : ""}
        ${(Number(data.total) - Number(data.amount_paid || 0)) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#B8837E;">
            <span>Saldo Pendiente</span>
            <span>${formatCurrency(Number(data.total) - Number(data.amount_paid || 0))}</span>
          </div>
        ` : ""}
      </div>
      <div style="border-top:1px solid #E8E0D8;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <p style="font-size:11px;font-style:italic;color:#B8837E;margin:0;">\u00a1Gracias por tu compra y por apoyar a ${settings?.business_name || "Almaia RD"}, aliados a tu bienestar!</p>
          <p style="font-size:11px;color:#9C8A82;margin:6px 0 0;">Nutrilite \u00b7 Artistry \u00b7 Glister \u00b7 G&H \u00b7 Satinique \u00b7 Amway Home</p>
        </div>
        <div style="text-align:right;">
          ${settings?.signature_url ? `<img src="${settings.signature_url}" alt="Firma" style="height:96px;margin-left:auto;" />` : `<p style="font-size:16px;font-style:italic;color:#5C3E35;font-weight:300;margin:0;font-family:Georgia,serif;">${settings?.business_name || "ALMAIA"}</p>`}
          <p style="font-size:9px;color:#9C8A82;margin:2px 0 0;">FIRMA AUTORIZADA</p>
        </div>
      </div>
    `;
    return el;
  }

  async function captureInvoice(inv: any) {
    const full = await getInvoice(inv.id);
    const el = await buildPreviewEl(full, settings);
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 500));
    const domtoimage = await import("dom-to-image-more");
    const canvas = await domtoimage.toCanvas(el, { scale: 2, width: 800 });
    document.body.removeChild(el);
    return { canvas, data: full, invoice_number: inv.invoice_number };
  }

  async function handlePrintPdf(inv: any) {
    try {
      const { canvas, invoice_number } = await captureInvoice(inv);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const jspdfModule = await import("jspdf");
      const pdf = new jspdfModule.default({ unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      const clientName = inv.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
      pdf.save(`factura-${invoice_number}-${clientName}.pdf`);
      toast.success("PDF descargado");
    } catch (e) {
      console.error("[handlePrintPdf]", e);
      toast.error("Error al generar PDF");
    }
  }

  async function handlePrintJpg(inv: any) {
    try {
      const { canvas, invoice_number } = await captureInvoice(inv);
      const link = document.createElement("a");
      const clientName = inv.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
      link.download = `factura-${invoice_number}-${clientName}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      toast.success("JPG descargado");
    } catch (e) {
      console.error("[handlePrintJpg]", e);
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
        itbis: item.itbis ?? false,
      })) || []);
      setDiscountPercent(0);
      setDiscountAmount(Number(full.discount_amount));
      setNotes(full.notes || "");
      setBankAccountId(full.bank_account_id || "");
      setMargin(full.margin || 30);
      setInvoiceDate(full.invoice_date || getLocalDateString());
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
        invoice_date: invoiceDate,
        discount_amount: discountValue,
        status: "PENDING" as const,
        margin,
        notes: notes || undefined,
        bank_account_id: bankAccountId || undefined,
      };
      const invoiceItems = items.map((i) => ({
        product_id: i.product_id || undefined,
        quantity: i.quantity,
        unit_price: effectivePrice(i),
        line_total: i.quantity * effectivePrice(i),
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

      <div className="flex gap-3 mb-6 flex-wrap">
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
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        {(filterMonth || filterYear || filterStatus || filterClient) && (
          <button onClick={() => { setFilterMonth(""); setFilterYear(""); setFilterStatus(""); setFilterClient(""); }} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3">Limpiar filtros</button>
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
                  if (filterStatus && inv.status !== filterStatus) return false;
                  if (filterClient && inv.client_id !== filterClient) return false;
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
                <div className="w-14 h-14 rounded-full bg-[#B8837E]/10 flex items-center justify-center mt-1">
                  <Flower2 size={28} className="text-[#B8837E]" />
                </div>
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
                    {selectedInvoice.bank_accounts.id_number && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cédula/RNC:</span> {selectedInvoice.bank_accounts.id_number}</p>}
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Banco:</span> {selectedInvoice.bank_accounts.bank_name}</p>
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Tipo de Cuenta:</span> {selectedInvoice.bank_accounts.account_type}</p>
                    <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">No. de Cuenta:</span> {selectedInvoice.bank_accounts.account_number}</p>
                    {selectedInvoice.bank_accounts.email && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Correo:</span> {selectedInvoice.bank_accounts.email}</p>}
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
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handlePrintPdf(selectedInvoice)} className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <FileText size={18} /> PDF
              </button>
              <button onClick={() => handlePrintJpg(selectedInvoice)} className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={18} /> JPG
              </button>
              {selectedInvoice.clients?.email && (
                <button
                  onClick={() => setDraftModal({ type: "email" })}
                  className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={18} /> Email
                </button>
              )}
              {selectedInvoice.clients?.phone && (
                <button
                  onClick={() => setDraftModal({ type: "whatsapp" })}
                  className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> WhatsApp
                </button>
              )}
              {(selectedInvoice.status === "PENDING" || selectedInvoice.status === "PARTIAL") && (
                <button onClick={() => { setShowDetail(false); setSelectedInvoice(null); router.push(`/recibos?nuevo=true&invoice_id=${selectedInvoice.id}`); }} className="flex-1 min-w-[120px] h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all flex items-center justify-center gap-2">
                  <DollarSign size={18} /> Registrar Pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {draftModal && selectedInvoice && (
        <CommunicationDraftModal
          isOpen={true}
          onClose={() => setDraftModal(null)}
          type={draftModal.type}
          client={{
            id: selectedInvoice.client_id,
            full_name: selectedInvoice.clients?.full_name || "",
            email: selectedInvoice.clients?.email,
            phone: selectedInvoice.clients?.phone,
          }}
          documentType="invoice"
          documentNumber={selectedInvoice.invoice_number}
          documentId={selectedInvoice.id}
          total={formatCurrency(selectedInvoice.total)}
          businessName={settings?.business_name || "Almaia RD"}
          senderEmail={settings?.email || undefined}
          senderName={settings?.sender_name || undefined}
          emailTemplate={(settings as any)?.email_template || undefined}
          whatsappTemplate={(settings as any)?.whatsapp_template || undefined}
          smtp={(settings as any)?.smtp_host ? {
            host: (settings as any).smtp_host,
            port: (settings as any).smtp_port || 587,
            user: (settings as any).smtp_user,
            pass: (settings as any).smtp_pass,
            secure: (settings as any).smtp_secure || false,
            senderName: (settings as any).sender_name || undefined,
          } : undefined}
          getAttachment={async () => {
            const { canvas, invoice_number } = await captureInvoice(selectedInvoice);
            const jspdfModule = await import("jspdf");
            const pdf = new jspdfModule.default({ unit: "px", format: [canvas.width, canvas.height] });
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, canvas.width, canvas.height);
            const base64 = pdf.output("datauristring").split(",")[1];
            const clientName = selectedInvoice?.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
            return { filename: `factura-${invoice_number}-${clientName}.pdf`, base64 };
          }}
        />
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? "Editar Factura" : "Nueva Factura"} wide>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha de factura</label>
            <input
              type="date" value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            />
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
                      <span className="text-[#9C8A82] text-xs">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    onClick={() => { setShowManualProduct(false); setManualProduct({ name: "", quantity: 1, unit_price: 0, itbis: false }); }}
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
                  <div key={i} className="flex items-center gap-3 bg-[#FAF6F0] rounded-xl p-3 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 text-sm text-[#5C3E35] min-w-[120px] sm:min-w-0">{item.name}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[i].quantity = Number(e.target.value);
                          setItems(newItems);
                        }}
                        className="w-14 sm:w-16 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                      <input
                        type="number" step="0.01" value={effectivePrice(item)}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[i].unit_price = Number(e.target.value);
                          delete newItems[i].price_30;
                          delete newItems[i].price_35;
                          setItems(newItems);
                        }}
                        className="w-20 sm:w-24 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = [...items];
                          newItems[i].itbis = !newItems[i].itbis;
                          setItems(newItems);
                        }}
                        className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${item.itbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                      >
                        <div className={`absolute top-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full shadow-sm transition-transform ${item.itbis ? "translate-x-[18px] sm:translate-x-6" : "translate-x-0.5"}`} />
                      </button>
                      <span className={`text-sm font-medium w-16 sm:w-20 text-right ${item.itbis ? "text-[#5C3E35]" : "text-[#9C8A82]"}`}>
                        {formatCurrency(item.quantity * effectivePrice(item))}
                      </span>
                      <button onClick={() => removeItem(i)} className="p-1 text-[#D4A0A0] hover:bg-white rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {(() => {
              const selected = bankAccounts.find(b => b.id === bankAccountId);
              if (!selected) return null;
              return (
                <div className="mt-2 bg-[#FAF6F0] rounded-lg p-3 text-sm space-y-1">
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Beneficiario:</span> {selected.holder_name}</p>
                  {selected.id_number && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cédula/RNC:</span> {selected.id_number}</p>}
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Banco:</span> {selected.bank_name}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Tipo:</span> {selected.account_type}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">No. Cuenta:</span> {selected.account_number}</p>
                  {selected.email && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Correo:</span> {selected.email}</p>}
                </div>
              );
            })()}
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
       <div ref={jpgRef} style={{ display: jpgData ? "block" : "none", position: "fixed", top: 0, left: 0, zIndex: 9999, background: "#ffffff", width: "800px" }}>
        {jpgData && (
          <div id="invoice-preview" className="bg-white p-8" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start gap-2">
                <div className="w-14 h-14 rounded-full bg-[#B8837E]/10 flex items-center justify-center mt-1">
                  <Flower2 size={28} className="text-[#B8837E]" />
                </div>
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
                  {jpgData.bank_accounts.id_number && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cédula/RNC:</span> {jpgData.bank_accounts.id_number}</p>}
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Banco:</span> {jpgData.bank_accounts.bank_name}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Tipo de Cuenta:</span> {jpgData.bank_accounts.account_type}</p>
                  <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">No. de Cuenta:</span> {jpgData.bank_accounts.account_number}</p>
                  {jpgData.bank_accounts.email && <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Correo:</span> {jpgData.bank_accounts.email}</p>}
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
