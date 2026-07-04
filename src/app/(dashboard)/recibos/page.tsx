"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getReceipts, getReceipt, createReceipt, deleteReceipt, updateReceiptWithInvoice } from "@/services/receipts";
import { getInvoices, getBankAccounts } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import { getLocalDateString } from "@/lib/utils";
import { formatCurrency, formatDate, numberToWords } from "@/lib/utils";
import { Receipt, Plus, Search, Eye, Printer, Trash2, X, Save, Wallet, Download, Edit2, Flower2, Mail, MessageCircle } from "lucide-react";
import type { BankAccount, Settings } from "@/types/database";
import toast from "react-hot-toast";
import { normalize } from "@/lib/search";
import CommunicationDraftModal from "@/components/communications/CommunicationDraftModal";

const methodMap: Record<string, { label: string; variant: "success" | "warning" | "info" | "neutral" }> = {
  CASH: { label: "Efectivo", variant: "success" },
  TRANSFER: { label: "Transferencia", variant: "info" },
  CARD: { label: "Tarjeta", variant: "warning" },
};

const methodLabel: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
};

export default function RecibosPage() {
  const searchParams = useSearchParams();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [openPrintId, setOpenPrintId] = useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [draftModal, setDraftModal] = useState<{ type: "email" | "whatsapp" } | null>(null);
  const [receiptDate, setReceiptDate] = useState(getLocalDateString());
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "CARD">("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const [editForm, setEditForm] = useState({ amount: 0, payment_method: "CASH" as "CASH" | "TRANSFER" | "CARD", bank_account_id: "", concept: "", receipt_date: "" });

  const load = useCallback(async () => {
    try {
      const [rec, inv, ba, st] = await Promise.all([getReceipts(), getInvoices(), getBankAccounts(), getSettings().catch(() => null)]);
      setReceipts(rec);
      setPendingInvoices(inv.filter((i: any) => i.status !== "PAID" && i.status !== "CANCELLED"));
      setBankAccounts(ba);
      setSettings(st);
    } catch { toast.error("Error al cargar recibos"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("nuevo") === "true") {
      resetForm();
      const invId = searchParams.get("invoice_id");
      if (invId) setSelectedInvoice(invId);
      setShowModal(true);
    }
  }, [searchParams]);

  function resetForm() {
    setSelectedInvoice("");
    setReceiptDate(getLocalDateString());
    setAmount(0);
    setPaymentMethod("CASH");
    setBankAccountId("");
    setNotes("");
  }

  const selectedInvoiceData = pendingInvoices.find((i: any) => i.id === selectedInvoice);
  const balanceDue = selectedInvoiceData ? Number(selectedInvoiceData.total) - Number(selectedInvoiceData.amount_paid || 0) : 0;

  const receiptSearchFiltered = receipts.filter((r: any) => {
    // Filter by status
    if (filterStatus !== "all") {
      const invoiceStatus = r.invoices?.status;
      if (filterStatus === "paid" && invoiceStatus !== "PAID") return false;
      if (filterStatus === "pending" && invoiceStatus === "PAID") return false;
    }

    // Filter by search query
    if (searchQuery) {
      const q = normalize(searchQuery);
      const matchesSearch =
        normalize(r.receipt_number ?? "").includes(q) ||
        normalize(r.invoices?.invoice_number ?? "").includes(q) ||
        normalize(r.clients?.full_name ?? "").includes(q) ||
        normalize(r.invoices?.clients?.full_name ?? "").includes(q);
      if (!matchesSearch) return false;
    }

    // Filter by month/year
    if (filterMonth || filterYear) {
      const d = new Date(r.created_at);
      if (filterMonth && String(d.getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
      if (filterYear && String(d.getFullYear()) !== filterYear) return false;
    }

    return true;
  });

  async function buildReceiptPreviewEl(data: any, settings: any) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:0;left:0;z-index:9999;background:#fff;width:600px;padding:32px;font-family:system-ui,sans-serif;font-size:16px;";
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(184,131,126,0.1);display:flex;align-items:center;justify-content:center;margin-top:4px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8837E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/></svg>
          </div>
          <div>
            <h2 style="font-size:24px;font-weight:700;color:#5C3E35;margin:0;">${settings?.business_name || "ALMAIA"}</h2>
            <p style="font-size:12px;letter-spacing:0.1em;color:#B8837E;text-transform:uppercase;margin:2px 0 0;">Bienestar & Salud</p>
            <p style="font-size:12px;color:#9C8A82;margin:4px 0 0;">Distribuidor Independiente Amway &middot; Rep\u00fablica Dominicana</p>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;background:#F0FAF4;color:#6DB08A;font-size:12px;font-weight:700;padding:8px 16px;border-radius:999px;white-space:nowrap;">RECIBO DE PAGO</span>
          <p style="font-size:18px;font-weight:700;color:#5C3E35;margin:12px 0 0;">${data.receipt_number}</p>
          <p style="font-size:12px;color:#9C8A82;margin:2px 0 0;">Fecha: ${formatDate(data.receipt_date || data.created_at)}</p>
        </div>
      </div>
      <div style="border-top:1px solid #E8E0D8;margin-bottom:20px;"></div>
      <div style="border:1px solid #E8E0D8;background:#FCFAF7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="font-size:11px;font-weight:700;color:#6DB08A;margin:0 0 12px;">INFORMACI\u00d3N DEL PAGO</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;">
          <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Cliente:</span> ${data.clients?.full_name || data.invoices?.clients?.full_name || "\u2014"}</p>
          <p style="color:#5C3E35;margin:0;"><span style="color:#9C8A82;">Factura:</span> ${data.invoices?.invoice_number || "\u2014"}</p>
          <p style="color:#5C3E35;margin:0;grid-column:1/-1;"><span style="color:#9C8A82;">M\u00e9todo de pago:</span> ${methodLabel[data.payment_method] || data.payment_method}${data.bank_accounts ? ` &mdash; ${data.bank_accounts.bank_name}` : ""}</p>
        </div>
      </div>

      ${(data.invoices?.invoice_items || []).length > 0 ? `
        <table style="width:100%;font-size:13px;margin-bottom:20px;border-collapse:collapse;">
          <thead>
            <tr style="background:#F0EBE3;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5C3E35;font-weight:700;">Descripci\u00f3n / Producto</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Cant.</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Precio Unit.</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#5C3E35;font-weight:700;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.invoice_items.map((item: any) => `
              <tr style="border-bottom:1px solid #F0EBE3;">
                <td style="padding:10px 12px;font-size:13px;color:#5C3E35;">${item.products?.name || item.custom_name || "Producto"}</td>
                <td style="padding:10px 12px;text-align:right;font-size:13px;color:#5C3E35;">${item.quantity}</td>
                <td style="padding:10px 12px;text-align:right;font-size:13px;color:#5C3E35;">${formatCurrency(Number(item.unit_price))}</td>
                <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:500;color:#5C3E35;">${formatCurrency(Number(item.line_total))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
      <div style="border-top:1px solid #E8E0D8;padding-top:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:flex-end;align-items:baseline;gap:16px;">
          <span style="font-size:14px;color:#9C8A82;">Monto pagado</span>
          <span style="font-size:24px;font-weight:700;color:#86C7A3;">${formatCurrency(Number(data.amount))}</span>
        </div>
        ${data.amount_in_words ? `<p style="font-size:11px;color:#9C8A82;font-style:italic;text-align:right;margin:4px 0 0;">Son: ${data.amount_in_words}</p>` : ""}
      </div>
      ${data.concept ? `
        <div style="border-top:1px solid #E8E0D8;padding-top:16px;margin-bottom:16px;">
          <p style="font-size:11px;color:#9C8A82;margin:0 0 4px;">Notas:</p>
          <p style="font-size:13px;color:#5C3E35;margin:0;">${data.concept}</p>
        </div>
      ` : ""}
      <div style="border-top:1px solid #E8E0D8;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end;">
        <p style="font-size:11px;font-style:italic;color:#B8837E;margin:0;">\u00a1Gracias por tu pago!</p>
        <div style="text-align:right;">
          ${settings?.signature_url ? `<img src="${settings.signature_url}" alt="Firma" style="height:96px;margin-left:auto;" />` : `<p style="font-size:14px;font-style:italic;color:#5C3E35;font-weight:300;margin:0;font-family:Georgia,serif;">${settings?.business_name || "ALMAIA"}</p>`}
          <p style="font-size:9px;color:#9C8A82;margin:2px 0 0;">FIRMA AUTORIZADA</p>
        </div>
      </div>
    `;
    return el;
  }

  async function captureReceipt(rec: any) {
    const full = await getReceipt(rec.id);
    const el = await buildReceiptPreviewEl(full, settings);
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 500));
    const domtoimage = await import("dom-to-image-more");
    const canvas = await domtoimage.toCanvas(el, { scale: 2, width: 600 });
    document.body.removeChild(el);
    return { canvas, data: full, receipt_number: rec.receipt_number };
  }

  async function handlePrintPdf(rec: any) {
    try {
      const { canvas, receipt_number } = await captureReceipt(rec);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const jspdfModule = await import("jspdf");
      const pdf = new jspdfModule.default({ unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      const clientName = rec.invoices?.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
      pdf.save(`recibo-${receipt_number}-${clientName}.pdf`);
      toast.success("PDF descargado");
    } catch (e) {
      console.error("[handlePrintPdf]", e);
      toast.error("Error al generar PDF");
    }
    setOpenPrintId(null);
  }

  async function handlePrintJpg(rec: any) {
    try {
      const { canvas, receipt_number } = await captureReceipt(rec);
      const link = document.createElement("a");
      const clientName = rec.invoices?.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
      link.download = `recibo-${receipt_number}-${clientName}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      toast.success("JPG descargado");
    } catch (e) {
      console.error("[handlePrintJpg]", e);
      toast.error("Error al generar JPG");
    }
    setOpenPrintId(null);
  }

  async function handleSave() {
    if (!selectedInvoice) { toast.error("Selecciona una factura"); return; }
    if (amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (paymentMethod === "TRANSFER" && !bankAccountId) { toast.error("Selecciona una cuenta bancaria"); return; }
    if (amount > balanceDue) {
      const ok = window.confirm(
        `El monto (${formatCurrency(amount)}) excede el saldo pendiente (${formatCurrency(balanceDue)}). ¿Deseas registrar un excedente como abono a favor?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const clientId = selectedInvoiceData?.client_id;
      await createReceipt({
        invoice_id: selectedInvoice,
        client_id: clientId,
        receipt_date: receiptDate,
        amount,
        payment_method: paymentMethod,
        bank_account_id: paymentMethod === "TRANSFER" ? bankAccountId : undefined,
        concept: notes || undefined,
      });
      toast.success(amount > balanceDue ? "Pago registrado con excedente como abono a favor" : "Recibo creado exitosamente");
      setShowModal(false);
      resetForm();
      load();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "Error al crear recibo"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!selectedReceipt) return;
    setSaving(true);
    try {
      await updateReceiptWithInvoice(selectedReceipt.id, {
        amount: editForm.amount,
        receipt_date: editForm.receipt_date,
        payment_method: editForm.payment_method,
        bank_account_id: editForm.payment_method === "TRANSFER" ? editForm.bank_account_id : undefined,
        concept: editForm.concept || undefined,
        invoice_id: selectedReceipt.invoice_id,
        _old_amount: Number(selectedReceipt.amount),
      });
      toast.success("Recibo actualizado");
      setShowEditModal(false);
      setSelectedReceipt(null);
      load();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "Error al actualizar recibo"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Estás segura de eliminar este recibo?")) return;
    try {
      await deleteReceipt(id);
      toast.success("Recibo eliminado");
      load();
    } catch { toast.error("Error al eliminar recibo"); }
  }

  function openEdit(rec: any) {
    setSelectedReceipt(rec);
    setEditForm({
      amount: Number(rec.amount),
      payment_method: rec.payment_method,
      bank_account_id: rec.bank_account_id || "",
      concept: rec.concept || "",
      receipt_date: rec.receipt_date || getLocalDateString(),
    });
    setShowEditModal(true);
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Recibos</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Comprobantes de pago emitidos a clientes</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#86C7A3] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all shadow-sm"
        >
          <Plus size={18} />
          Registrar Pago
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar recibo por número, factura o cliente..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
        />
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30">
          <option value="all">Todos los estados</option>
          <option value="paid">Pagados</option>
          <option value="pending">Pendientes</option>
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30">
          <option value="">Todos los meses</option>
          {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30">
          <option value="">Todos los años</option>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {(filterMonth || filterYear || filterStatus !== "all") && (
          <button onClick={() => { setFilterMonth(""); setFilterYear(""); setFilterStatus("all"); }} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3">Limpiar filtros</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#86C7A3] border-t-transparent rounded-full animate-spin" /></div>
      ) : receiptSearchFiltered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <Receipt size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay recibos registrados</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">No. Recibo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Factura</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Método</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {receiptSearchFiltered.map((rec: any) => {
                const m = methodMap[rec.payment_method] || methodMap.CASH;
                return (
                  <tr key={rec.id} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow">
                    <td className="px-4 py-3.5 text-sm font-medium text-[#5C3E35]">{rec.receipt_number}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{formatDate(rec.receipt_date || rec.created_at)}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35]">{rec.clients?.full_name || rec.invoices?.clients?.full_name || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35]">{rec.invoices?.invoice_number || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{formatCurrency(rec.amount)}</td>
                    <td className="px-4 py-3.5 text-center"><Badge variant={m.variant}>{m.label}</Badge></td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant={rec.invoices?.status === "PAID" ? "success" : "warning"}>
                        {rec.invoices?.status === "PAID" ? "Pagado" : "Pendiente"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setSelectedReceipt(rec); setShowDetail(true); }} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="Ver"><Eye size={15} /></button>
                        <button onClick={() => openEdit(rec)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="Editar"><Edit2 size={15} /></button>
                        <button onClick={() => handlePrintPdf(rec)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="PDF"><Printer size={15} /></button>
                        <button onClick={() => handlePrintJpg(rec)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg" title="JPG"><Download size={15} /></button>
                        <button onClick={() => handleDelete(rec.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg" title="Eliminar"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedReceipt(null); }} title={selectedReceipt?.receipt_number || "Detalle"} wide>
        {selectedReceipt && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9C8A82]">Cliente</p>
                <p className="text-sm font-medium text-[#5C3E35]">{selectedReceipt.clients?.full_name || selectedReceipt.invoices?.clients?.full_name || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#9C8A82]">Fecha</p>
                <p className="text-sm text-[#5C3E35]">{formatDate(selectedReceipt.receipt_date || selectedReceipt.created_at)}</p>
              </div>
            </div>

            <div className="bg-[#F0FAF4] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6DB08A]">Factura asociada</span>
                <span className="text-[#5C3E35] font-medium">{selectedReceipt.invoices?.invoice_number || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6DB08A]">Método de pago</span>
                <span className="text-[#5C3E35]" style={{whiteSpace:"nowrap"}}>{methodLabel[selectedReceipt.payment_method] || selectedReceipt.payment_method}{selectedReceipt.bank_accounts ? ` — ${selectedReceipt.bank_accounts.bank_name}` : ""}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#86C7A3]/30">
                <span>Monto pagado</span>
                <span className="text-[#86C7A3]">{formatCurrency(selectedReceipt.amount)}</span>
              </div>
            </div>

            {(selectedReceipt.invoices?.invoice_items || []).length > 0 && (
              <div>
                <table className="w-full text-sm mb-5">
                  <thead>
                    <tr className="bg-[#F0EBE3]">
                      <th className="py-2.5 px-3 text-left text-xs text-[#5C3E35] font-bold">Descripci\u00f3n / Producto</th>
                      <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Cant.</th>
                      <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-right text-xs text-[#5C3E35] font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReceipt.invoices?.invoice_items || []).map((item: any, i: number) => (
                      <tr key={i} className="border-b border-[#F0EBE3]">
                        <td className="py-2.5 px-3 text-sm text-[#5C3E35]">{item.products?.name || item.custom_name || "Producto"}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-[#5C3E35]">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="py-2.5 px-3 text-right text-sm font-medium text-[#5C3E35]">{formatCurrency(Number(item.line_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReceipt.amount_in_words && (
              <p className="text-sm text-[#9C8A82] italic">Son: {selectedReceipt.amount_in_words}</p>
            )}

            {selectedReceipt.concept && (
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Notas</p>
                <p className="text-sm text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3">{selectedReceipt.concept}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button onClick={() => handlePrintPdf(selectedReceipt)} className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Printer size={18} /> PDF
              </button>
              <button onClick={() => { setShowDetail(false); handlePrintJpg(selectedReceipt); }} className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={18} /> JPG
              </button>
              {(selectedReceipt.clients?.email || selectedReceipt.invoices?.clients?.email) && (
                <button
                  onClick={() => setDraftModal({ type: "email" })}
                  className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={18} /> Email
                </button>
              )}
              {(selectedReceipt.clients?.phone || selectedReceipt.invoices?.clients?.phone) && (
                <button
                  onClick={() => setDraftModal({ type: "whatsapp" })}
                  className="flex-1 min-w-[120px] h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {draftModal && selectedReceipt && (
        <CommunicationDraftModal
          isOpen={true}
          onClose={() => setDraftModal(null)}
          type={draftModal.type}
          client={{
            id: selectedReceipt.client_id,
            full_name: selectedReceipt.clients?.full_name || selectedReceipt.invoices?.clients?.full_name || "",
            email: selectedReceipt.clients?.email || selectedReceipt.invoices?.clients?.email,
            phone: selectedReceipt.clients?.phone || selectedReceipt.invoices?.clients?.phone,
          }}
          documentType="receipt"
          documentNumber={selectedReceipt.receipt_number}
          documentId={selectedReceipt.id}
          total={formatCurrency(selectedReceipt.amount)}
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
            const { canvas, receipt_number } = await captureReceipt(selectedReceipt);
            const jspdfModule = await import("jspdf");
            const pdf = new jspdfModule.default({ unit: "px", format: [canvas.width, canvas.height] });
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, canvas.width, canvas.height);
            const base64 = pdf.output("datauristring").split(",")[1];
            const clientName = selectedReceipt?.invoices?.clients?.full_name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '-') || 'cliente';
            return { filename: `recibo-${receipt_number}-${clientName}.pdf`, base64 };
          }}
        />
      )}

      {/* Edit modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedReceipt(null); }} title="Editar Recibo" subtitle={selectedReceipt?.receipt_number || ""} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Monto</label>
              <input
                type="number" step="0.01" value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Método de pago</label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value as any, bank_account_id: "" })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </div>
          </div>
          {editForm.payment_method === "TRANSFER" && (
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cuenta bancaria destino</label>
              <select
                value={editForm.bank_account_id}
                onChange={(e) => setEditForm({ ...editForm, bank_account_id: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              >
                <option value="">Seleccionar banco...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name} — {b.account_type} — No. {b.account_number}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea
              value={editForm.concept} onChange={(e) => setEditForm({ ...editForm, concept: e.target.value })}
              rows={3}
              placeholder="Notas del recibo..."
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowEditModal(false); setSelectedReceipt(null); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleEditSave} disabled={saving} className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment form modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="Registrar Pago" subtitle={selectedInvoiceData?.clients?.full_name ? `Cliente: ${selectedInvoiceData.clients.full_name}` : undefined} wide>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Factura</label>
            <select
              value={selectedInvoice}
              onChange={(e) => { setSelectedInvoice(e.target.value); setAmount(0); }}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
            >
              <option value="">Seleccionar factura...</option>
              {pendingInvoices.map((inv: any) => {
                const due = Number(inv.total) - Number(inv.amount_paid || 0);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {inv.clients?.full_name} — Pend. {formatCurrency(due)}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedInvoiceData && (
            <div className="bg-[#F0FAF4] rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-[#6DB08A]">Total factura</span><span>{formatCurrency(selectedInvoiceData.total)}</span></div>
              <div className="flex justify-between"><span className="text-[#6DB08A]">Pagado</span><span>{formatCurrency(selectedInvoiceData.amount_paid || 0)}</span></div>
              <div className="flex justify-between font-bold text-[#5C3E35] pt-1 border-t border-[#86C7A3]/30">
                <span>Saldo pendiente</span><span>{formatCurrency(balanceDue)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha del recibo</label>
            <input
              type="date" value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Monto</label>
              <input
                type="number" step="0.01" value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Método de pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value as any); setBankAccountId(""); }}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </div>
          </div>

          {paymentMethod === "TRANSFER" && (
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cuenta bancaria destino</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all"
              >
                <option value="">Seleccionar banco...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name} — {b.account_type} — No. {b.account_number}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Registrar Pago"}
            </button>
          </div>
        </div>
      </Modal>


    </PageContainer>
  );
}
