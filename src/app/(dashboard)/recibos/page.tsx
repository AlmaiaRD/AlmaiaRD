"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getReceipts, createReceipt, deleteReceipt, updateReceiptWithInvoice } from "@/services/receipts";
import { getInvoices, getBankAccounts } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import { formatCurrency, formatDate, numberToWords } from "@/lib/utils";
import { generateReceiptPdf } from "@/lib/pdf";
import { Receipt, Plus, Search, Eye, Printer, Trash2, X, Save, Wallet, Download, Edit2, Flower2 } from "lucide-react";
import type { BankAccount, Settings } from "@/types/database";
import toast from "react-hot-toast";

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
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [jpgData, setJpgData] = useState<any>(null);
  const jpgRef = useRef<HTMLDivElement>(null);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "CARD">("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const [editForm, setEditForm] = useState({ amount: 0, payment_method: "CASH" as "CASH" | "TRANSFER" | "CARD", bank_account_id: "", concept: "" });

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
    setAmount(0);
    setPaymentMethod("CASH");
    setBankAccountId("");
    setNotes("");
  }

  const selectedInvoiceData = pendingInvoices.find((i: any) => i.id === selectedInvoice);
  const balanceDue = selectedInvoiceData ? Number(selectedInvoiceData.total) - Number(selectedInvoiceData.amount_paid || 0) : 0;

  const receiptSearchFiltered = receipts.filter((r: any) => {
    if (!searchQuery) {
      if (filterMonth || filterYear) {
        const d = new Date(r.created_at);
        if (filterMonth && String(d.getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
        if (filterYear && String(d.getFullYear()) !== filterYear) return false;
      }
      return true;
    }
    const q = searchQuery.toLowerCase();
    return (
      r.receipt_number?.toLowerCase().includes(q) ||
      r.invoices?.invoice_number?.toLowerCase().includes(q) ||
      r.clients?.full_name?.toLowerCase().includes(q) ||
      r.invoices?.clients?.full_name?.toLowerCase().includes(q)
    );
  });

  async function handlePrintPdf(rec: any) {
    await generateReceiptPdf({
      receipt_number: rec.receipt_number,
      receipt_date: formatDate(rec.created_at),
      client_name: rec.clients?.full_name || rec.invoices?.clients?.full_name || "Cliente",
      invoice_number: rec.invoices?.invoice_number || "—",
      amount: Number(rec.amount),
      amount_in_words: rec.amount_in_words || numberToWords(Number(rec.amount)),
      payment_method: methodLabel[rec.payment_method] || rec.payment_method,
      logo_url: settings?.logo_url,
      signature_url: settings?.signature_url,
      business_name: settings?.business_name,
      email: settings?.email,
      phone: settings?.phone,
    });
  }

  async function handlePrintJpg(rec: any) {
    try {
      setJpgData(rec);
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
      link.download = `recibo-${rec.receipt_number}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      setJpgData(null);
      toast.success("JPG descargado");
    } catch {
      toast.error("Error al generar JPG");
    }
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

      <div className="flex gap-3 mb-6">
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
        {(filterMonth || filterYear) && (
          <button onClick={() => { setFilterMonth(""); setFilterYear(""); }} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3">Limpiar filtros</button>
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {receiptSearchFiltered.map((rec: any) => {
                const m = methodMap[rec.payment_method] || methodMap.CASH;
                return (
                  <tr key={rec.id} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow">
                    <td className="px-4 py-3.5 text-sm font-medium text-[#5C3E35]">{rec.receipt_number}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{formatDate(rec.created_at)}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35]">{rec.clients?.full_name || rec.invoices?.clients?.full_name || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35]">{rec.invoices?.invoice_number || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{formatCurrency(rec.amount)}</td>
                    <td className="px-4 py-3.5 text-center"><Badge variant={m.variant}>{m.label}</Badge></td>
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
                <p className="text-sm text-[#5C3E35]">{formatDate(selectedReceipt.created_at)}</p>
              </div>
            </div>

            <div className="bg-[#F0FAF4] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6DB08A]">Factura asociada</span>
                <span className="text-[#5C3E35] font-medium">{selectedReceipt.invoices?.invoice_number || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6DB08A]">Método de pago</span>
                <span className="text-[#5C3E35]">{methodLabel[selectedReceipt.payment_method] || selectedReceipt.payment_method}</span>
              </div>
              {selectedReceipt.bank_accounts && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6DB08A]">Cuenta bancaria</span>
                  <span className="text-[#5C3E35]">{selectedReceipt.bank_accounts.bank_name} — {selectedReceipt.bank_accounts.account_number}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#86C7A3]/30">
                <span>Monto pagado</span>
                <span className="text-[#86C7A3]">{formatCurrency(selectedReceipt.amount)}</span>
              </div>
            </div>

            {selectedReceipt.amount_in_words && (
              <p className="text-sm text-[#9C8A82] italic">Son: {selectedReceipt.amount_in_words}</p>
            )}

            {selectedReceipt.concept && (
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Notas</p>
                <p className="text-sm text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3">{selectedReceipt.concept}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => handlePrintPdf(selectedReceipt)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Printer size={18} /> Descargar PDF
              </button>
              <button onClick={() => { setShowDetail(false); handlePrintJpg(selectedReceipt); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={18} /> Descargar JPG
              </button>
            </div>
          </div>
        )}
      </Modal>

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

      {/* Hidden preview for JPG capture */}
      <div ref={jpgRef} style={{ display: "none", position: "fixed", top: 0, left: 0, zIndex: 9999, background: "#ffffff", width: "600px" }}>
        {jpgData && (
          <div id="receipt-preview" className="bg-white p-8" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start gap-2">
                <Flower2 size={24} className="text-[#B8837E] mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-[#5C3E35]">{settings?.business_name || "ALMAIA"}</h2>
                  <p className="text-xs tracking-widest text-[#B8837E] uppercase mt-0.5">Bienestar & Salud</p>
                  <p className="text-xs text-[#9C8A82] mt-1">Distribuidor Independiente Amway · República Dominicana</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-[#F0FAF4] text-[#6DB08A] text-xs font-bold px-4 py-2 rounded-full">RECIBO DE PAGO</span>
                <p className="text-lg font-bold text-[#5C3E35] mt-3">{jpgData.receipt_number}</p>
                <p className="text-xs text-[#9C8A82] mt-0.5">Fecha: {formatDate(jpgData.created_at)}</p>
              </div>
            </div>
            <div className="border-t border-[#E8E0D8] mb-5" />
            <div className="space-y-3 text-sm mb-5">
              <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cliente:</span> {jpgData.clients?.full_name || jpgData.invoices?.clients?.full_name || "—"}</p>
              <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Factura:</span> {jpgData.invoices?.invoice_number || "—"}</p>
              <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Método de pago:</span> {methodLabel[jpgData.payment_method] || jpgData.payment_method}</p>
              {jpgData.bank_accounts && (
                <p className="text-[#5C3E35]"><span className="text-[#9C8A82]">Cuenta:</span> {jpgData.bank_accounts.bank_name} — {jpgData.bank_accounts.account_number}</p>
              )}
            </div>
            <div className="border-t border-[#E8E0D8] pt-4 flex justify-between items-end">
              <div className="text-right w-full">
                <p className="text-sm text-[#9C8A82] mb-1">Monto pagado</p>
                <p className="text-2xl font-bold text-[#86C7A3]">{formatCurrency(Number(jpgData.amount))}</p>
                {jpgData.amount_in_words && (
                  <p className="text-xs text-[#9C8A82] italic mt-1">Son: {jpgData.amount_in_words}</p>
                )}
              </div>
            </div>
            {jpgData.concept && (
              <div className="mt-4 pt-4 border-t border-[#E8E0D8]">
                <p className="text-xs text-[#9C8A82] mb-1">Notas:</p>
                <p className="text-sm text-[#5C3E35]">{jpgData.concept}</p>
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-[#E8E0D8] flex justify-between items-end">
              <p className="text-xs italic text-[#B8837E]">¡Gracias por tu pago!</p>
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
