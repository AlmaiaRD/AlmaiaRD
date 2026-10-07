"use client";

import { useState, useEffect } from "react";
import { normalize } from "@/lib/search";
import PageContainer from "@/components/layout/PageContainer";
import { getCreditsSummary, getClientPendingInvoices, applyCreditToInvoice } from "@/services/credits";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, Search, ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { CreditWithRelations, InvoiceWithClient } from "@/types/relations";

/** El select real es `*, clients(full_name, phone)`. */
type CreditRecord = CreditWithRelations;

/** Columnas que la pantalla necesita de cada factura. */
type InvoiceRecord = Pick<
  InvoiceWithClient,
  "id" | "invoice_number" | "total" | "status" | "invoice_date"
> & { balance_due: number };

export default function CreditosPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyAmount, setApplyAmount] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const data = await getCreditsSummary();
      setCredits(data.active as CreditRecord[]);
      setTotalAvailable(data.totalAvailable);
    } catch {
      toast.error("Error al cargar créditos");
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices(clientId: string) {
    setLoadingInvoices(true);
    try {
      const data = await getClientPendingInvoices(clientId);
      setInvoices(data as InvoiceRecord[]);
    } catch {
      toast.error("Error al cargar facturas");
    } finally {
      setLoadingInvoices(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await getCreditsSummary();
        setCredits(data.active as CreditRecord[]);
        setTotalAvailable(data.totalAvailable);
      } catch {
        toast.error("Error al cargar créditos");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = credits.filter((c) => {
    const q = normalize(searchQuery);
    return normalize(c.clients?.full_name || "").includes(q)
      || normalize(c.receipts?.receipt_number || "").includes(q);
  });

  async function handleApply(credit: CreditRecord) {
    if (applyAmount <= 0) { toast.error("Monto inválido"); return; }
    if (!selectedInvoiceId) { toast.error("Selecciona una factura"); return; }
    const available = Number(credit.balance ?? credit.amount);
    if (applyAmount > available) { toast.error("Excede el saldo disponible"); return; }
    const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (invoice && applyAmount > Number(invoice.balance_due)) {
      toast.error("El monto excede el saldo pendiente de la factura");
      return;
    }
    setSaving(true);
    try {
      await applyCreditToInvoice(credit.id, selectedInvoiceId, applyAmount);
      toast.success("Crédito aplicado a la factura");
      setSelectedId(null);
      setSelectedInvoiceId(null);
      setApplyAmount(0);
      await loadData();
    } catch {
      toast.error("Error al aplicar crédito");
    } finally { setSaving(false); }
  }

  function openApply(credit: CreditRecord) {
    setSelectedId(credit.id);
    setApplyAmount(Number(credit.balance ?? credit.amount));
    setSelectedInvoiceId(null);
    loadInvoices(credit.client_id);
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-[#4C5760] hover:text-[#39484F] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver a CRM
        </button>
        <h1 className="text-[30px] font-marca text-[#39484F]">Saldos a Favor</h1>
        <p className="text-sm text-[#4C5760] mt-1">Abonos y créditos disponibles de clientes</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E0DAD3] mb-6">
        <p className="text-xs text-[#4C5760] mb-1">Total Disponible</p>
        <p className="text-2xl font-bold text-[#86C7A3]">{formatCurrency(totalAvailable)}</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4C5760]" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por cliente o recibo..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E0DAD3] bg-white text-[#39484F] placeholder-[#4C5760] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#86C7A3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#4C5760]">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? "Sin resultados" : "No hay saldos a favor registrados"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E0DAD3] hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-[#39484F]">{c.clients?.full_name || "Sin cliente"}</p>
                  <p className="text-xs text-[#4C5760]">{c.receipts?.receipt_number || "—"} &middot; {formatDate(c.created_at)}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">Disponible</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#4C5760]">Disponible:</span>
                  <span className="text-sm text-[#39484F] ml-1">{formatCurrency(Number(c.balance ?? c.amount))}</span>
                </div>
                <button onClick={() => openApply(c)} className="flex items-center gap-1 text-xs text-[#86C7A3] hover:underline">
                  Aplicar <ArrowRight size={12} />
                </button>
              </div>

              {selectedId === c.id && (
                <div className="mt-3 pt-3 border-t border-[#F0EBE3] space-y-3">
                  {loadingInvoices ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-[#86C7A3] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-[#4C5760]">No hay facturas pendientes para este cliente</p>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          value={selectedInvoiceId || ""}
                          onChange={(e) => setSelectedInvoiceId(e.target.value || null)}
                          className="w-full h-10 pl-3 pr-10 rounded-xl border border-[#E0DAD3] text-sm text-[#39484F] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3]"
                        >
                          <option value="">Seleccionar factura...</option>
                          {invoices.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_number} · Pendiente: {formatCurrency(Number(inv.balance_due))} · {formatDate(inv.invoice_date)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4C5760] pointer-events-none" size={18} />
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="number" value={applyAmount} max={Number(c.balance ?? c.amount)}
                          onChange={(e) => setApplyAmount(Math.min(Number(e.target.value) || 0, Number(c.balance ?? c.amount)))}
                          className="flex-1 h-10 px-3 rounded-xl border border-[#E0DAD3] text-sm text-[#39484F] focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3]" />
                        <button onClick={() => handleApply(c)} disabled={saving}
                          className="h-10 px-4 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all shadow-sm disabled:opacity-50">
                          {saving ? "Aplicando..." : "Aplicar a Factura"}
                        </button>
                        <button onClick={() => { setSelectedId(null); setSelectedInvoiceId(null); setApplyAmount(0); }} className="text-xs text-[#4C5760] hover:text-[#39484F]">Cancelar</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}