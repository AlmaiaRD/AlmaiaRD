"use client";

import { useState, useEffect, useCallback } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import { normalize } from "@/lib/search";
import { getInvoices } from "@/services/invoices";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Search, Phone, Wallet, ArrowUpRight } from "lucide-react";

export default function CuentasPorCobrarPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try { setInvoices(await getInvoices()); }
    catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = invoices.filter(i => i.status !== "PAID" && i.status !== "CANCELLED");
  const filtered = pending.filter(i =>
    normalize(i.clients?.full_name || "").includes(normalize(searchQuery)) ||
    normalize(i.invoice_number || "").includes(normalize(searchQuery))
  );
  const totalPending = filtered.reduce((s, i) => s + Number(i.total) - Number(i.paid_amount || 0), 0);

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#5C3E35]">Cuentas por Cobrar</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Saldos pendientes de clientes</p>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Total Pendiente</p>
          <p className="text-2xl font-bold text-[#5C3E35]">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-[#9C8A82] mt-1">{filtered.length} factura(s) pendientes</p>
        </div>
        <a href="/creditos" className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all min-w-[180px] block">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-[#86C7A3]" />
            <p className="text-xs text-[#9C8A82]">Saldos a Favor</p>
          </div>
          <p className="text-lg font-bold text-[#86C7A3]">RD$ 0.00</p>
          <p className="text-xs text-[#86C7A3] mt-1 flex items-center gap-1">Ver créditos <ArrowUpRight size={12} /></p>
        </a>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por cliente o factura..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <DollarSign size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay cuentas por cobrar pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv: any) => {
            const due = Number(inv.total) - Number(inv.paid_amount || 0);
            const statusLabel = inv.status === "PENDING" ? "Pendiente" : inv.status === "PARTIAL" ? "Pago Parcial" : inv.status;
            return (
              <div key={inv.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold text-[#5C3E35]">{inv.invoice_number}</span>
                    <span className="text-xs text-[#9C8A82] ml-2">{inv.clients?.full_name}</span>
                  </div>
                  <Badge variant={inv.status === "PENDING" ? "warning" : "info"}>{statusLabel}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9C8A82]">Total: {formatCurrency(inv.total)}</span>
                  <span className="text-[#5C3E35] font-bold">{formatCurrency(due)}</span>
                </div>
                {inv.clients?.phone && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[#9C8A82]">
                    <Phone size={12} />
                    <span>{inv.clients.phone}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
