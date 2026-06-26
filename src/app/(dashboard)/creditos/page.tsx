"use client";

import { useState, useEffect } from "react";
import { normalize } from "@/lib/search";
import PageContainer from "@/components/layout/PageContainer";
import { getCreditsSummary, useCreditBalance } from "@/services/credits";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, Search, ArrowRight, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface CreditRecord {
  id: string;
  client_id: string;
  receipt_id: string;
  amount: number;
  status: string;
  created_at: string;
  clients?: { full_name: string; phone: string } | null;
  receipts?: { receipt_number: string; receipt_date: string } | null;
}

export default function CreditosPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyAmount, setApplyAmount] = useState(0);
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

  useEffect(() => { loadData(); }, []);

  const filtered = credits.filter((c) => {
    const q = normalize(searchQuery);
    return normalize(c.clients?.full_name || "").includes(q)
      || normalize(c.receipts?.receipt_number || "").includes(q);
  });

  async function handleApply(credit: CreditRecord) {
    if (applyAmount <= 0) { toast.error("Monto inválido"); return; }
    if (applyAmount > Number(credit.amount)) { toast.error("Excede el saldo disponible"); return; }
    setSaving(true);
    try {
      await useCreditBalance(credit.id, applyAmount);
      toast.success("Crédito aplicado");
      setSelectedId(null);
      await loadData();
    } catch {
      toast.error("Error al aplicar crédito");
    } finally { setSaving(false); }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver a CRM
        </button>
        <h1 className="text-xl font-bold text-[#5C3E35]">Saldos a Favor</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Abonos y créditos disponibles de clientes</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] mb-6">
        <p className="text-xs text-[#9C8A82] mb-1">Total Disponible</p>
        <p className="text-2xl font-bold text-[#86C7A3]">{formatCurrency(totalAvailable)}</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por cliente o recibo..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#86C7A3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? "Sin resultados" : "No hay saldos a favor registrados"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-[#5C3E35]">{c.clients?.full_name || "Sin cliente"}</p>
                  <p className="text-xs text-[#9C8A82]">{c.receipts?.receipt_number || "—"} &middot; {formatDate(c.created_at)}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">Disponible</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#9C8A82]">Monto:</span>
                  <span className="text-sm text-[#5C3E35] ml-1">{formatCurrency(Number(c.amount))}</span>
                </div>
                <button onClick={() => { setSelectedId(c.id); setApplyAmount(Number(c.amount)); }}
                  className="flex items-center gap-1 text-xs text-[#86C7A3] hover:underline">
                  Aplicar <ArrowRight size={12} />
                </button>
              </div>

              {selectedId === c.id && (
                <div className="mt-3 pt-3 border-t border-[#F0EBE3] flex items-center gap-3">
                  <input type="number" value={applyAmount} max={Number(c.amount)}
                    onChange={(e) => setApplyAmount(Math.min(Number(e.target.value), Number(c.amount)))}
                    className="flex-1 h-10 px-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#86C7A3]/30 focus:border-[#86C7A3]" />
                  <button onClick={() => handleApply(c)} disabled={saving}
                    className="h-10 px-4 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all shadow-sm disabled:opacity-50">
                    {saving ? "Aplicando..." : "Aplicar a Factura"}
                  </button>
                  <button onClick={() => setSelectedId(null)} className="text-xs text-[#9C8A82] hover:text-[#5C3E35]">Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}