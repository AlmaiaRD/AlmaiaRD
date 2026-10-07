"use client";

import { useState, useEffect, useCallback } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getReturns, getReturnItems, getReturnedQuantitiesForInvoice, createReturn, completeReturn, cancelReturn } from "@/services/returns";
import { getInvoices, getInvoice } from "@/services/invoices";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Eye, X, Check, RotateCcw, Package } from "lucide-react";
import toast from "react-hot-toast";

interface ReturnWithRelations {
  id: string;
  return_number: string;
  invoice_id: string;
  client_id: string;
  return_date: string;
  subtotal: number;
  total: number;
  reason: string;
  status: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  clients?: { full_name: string } | null;
  invoices?: { invoice_number: string } | null;
}

interface InvoiceWithClient {
  id: string;
  invoice_number: string;
  client_id: string;
  total: number;
  status: string;
  clients?: { full_name: string } | null;
}

/**
 * Línea de factura normalizada para el formulario de devolución.
 *
 * Antes este formulario tomaba el precio del catálogo (`products.price_30`),
 * que es el precio de venta HOY, y no el precio cobrado en la factura. Una
 * devolución credited al cliente con el precio actual en lugar del facturado
 * deja la factura descuadrada. Aquí la fuente de verdad es `invoice_items`.
 */
interface InvoiceLine {
  product_id: string;
  name: string;
  billed_quantity: number;
  unit_price: number;
  /** Unidades aún devuelbles = facturado - ya devuelto en devoluciones completadas. */
  returnable_quantity: number;
}

interface ReturnItemWithProduct {
  id: string;
  return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason?: string;
  created_at: string;
  products?: { name: string; code?: string | null } | null;
}

const STATUS_COLORS: Record<string, "warning" | "success" | "danger"> = {
  DRAFT: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export default function DevolucionesPage() {
  const [returns, setReturns] = useState<ReturnWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithClient | null>(null);
  const [returnItems, setReturnItems] = useState<Array<{ product_id: string; name: string; quantity: number; unit_price: number; line_total: number; reason: string; maxQty: number }>>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [viewingReturn, setViewingReturn] = useState<ReturnWithRelations | null>(null);
  const [viewingItems, setViewingItems] = useState<ReturnItemWithProduct[]>([]);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      let data = await getReturns();
      if (query) {
        const q = query.toLowerCase();
        data = data.filter((r) =>
          r.return_number?.toLowerCase().includes(q) ||
          r.clients?.full_name?.toLowerCase().includes(q) ||
          r.invoices?.invoice_number?.toLowerCase().includes(q)
        );
      }
      setReturns(data);
    } catch {
      toast.error("Error al cargar devoluciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getReturns();
        setReturns(data);
      } catch {
        toast.error("Error al cargar devoluciones");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openNew() {
    setSaving(false);
    setReason("");
    setNotes("");
    setReturnItems([]);
    setSelectedInvoice(null);
    setInvoiceLines([]);
    try {
      const inv = await getInvoices();
      setInvoices(inv.filter((i: InvoiceWithClient) => i.status !== "CANCELLED"));
    } catch {
      toast.error("Error al cargar datos");
    }
    setShowModal(true);
  }

  async function handleSelectInvoice(invoiceId: string) {
    const inv = invoices.find((i: InvoiceWithClient) => i.id === invoiceId);
    setReturnItems([]);
    setInvoiceLines([]);
    if (!inv) {
      setSelectedInvoice(null);
      return;
    }
    setSelectedInvoice(inv);
    setReason(`Devolución de factura ${inv.invoice_number}`);
    setLoadingLines(true);
    try {
      // El precio y la cantidad devuelble se leen de la FACTURA, no del
      // catálogo: devolver a precio de hoy descuadra la factura.
      const [full, alreadyReturned] = await Promise.all([
        getInvoice(inv.id),
        getReturnedQuantitiesForInvoice(inv.id),
      ]);
      const items = (full?.invoice_items ?? []) as Array<{
        product_id: string | null;
        quantity: number | null;
        unit_price: number | null;
        custom_name: string | null;
        products?: { name?: string | null } | null;
      }>;
      setInvoiceLines(
        items
          .filter((it): it is typeof it & { product_id: string } => Boolean(it.product_id))
          .map((it) => {
            const billed = Number(it.quantity ?? 0);
            const returned = alreadyReturned[it.product_id] ?? 0;
            return {
              product_id: it.product_id,
              name: it.custom_name || it.products?.name || "Producto",
              billed_quantity: billed,
              unit_price: Number(it.unit_price ?? 0),
              returnable_quantity: Math.max(0, billed - returned),
            };
          })
      );
    } catch {
      toast.error("Error al cargar los productos de la factura");
    } finally {
      setLoadingLines(false);
    }
  }

  function addReturnItem(productId: string) {
    const line = invoiceLines.find((l) => l.product_id === productId);
    if (!line) {
      toast.error("Ese producto no está en la factura seleccionada");
      return;
    }
    if (returnItems.some((i) => i.product_id === productId)) {
      toast.error("Producto ya agregado");
      return;
    }
    if (line.returnable_quantity <= 0) {
      toast.error("No queda nada por devolver de este producto");
      return;
    }
    setReturnItems([...returnItems, {
      product_id: line.product_id,
      name: line.name,
      quantity: 1,
      // Precio COBRADO en la factura, no el precio actual del catálogo.
      unit_price: line.unit_price,
      line_total: line.unit_price,
      reason: "",
      maxQty: line.returnable_quantity,
    }]);
  }

  function updateReturnItem(index: number, field: string, value: unknown) {
    const items = [...returnItems];
    const item = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      if (field === "quantity") {
        // Nunca por encima de lo facturado y no devuelto todavía.
        item.quantity = Math.min(
          Math.max(1, Math.floor(Number(item.quantity) || 1)),
          items[index].maxQty
        );
      }
      item.line_total = Number(item.quantity) * Number(item.unit_price);
    }
    items[index] = item;
    setReturnItems(items);
  }

  function removeReturnItem(index: number) {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!selectedInvoice) { toast.error("Selecciona una factura"); return; }
    if (returnItems.length === 0) { toast.error("Agrega al menos un producto"); return; }

    setSaving(true);
    try {
      const subtotal = returnItems.reduce((s, i) => s + i.line_total, 0);
      await createReturn({
        invoice_id: selectedInvoice.id,
        client_id: selectedInvoice.client_id,
        return_date: new Date().toISOString().split("T")[0],
        subtotal,
        total: subtotal,
        reason,
        notes,
        status: "DRAFT",
      }, returnItems.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
        reason: i.reason || undefined,
      })));

      toast.success("Devolución creada");
      setShowModal(false);
      load("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear devolución");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(id: string) {
    if (!confirm("¿Completar esta devolución? Se ajustará el inventario.")) return;
    try {
      await completeReturn(id);
      toast.success("Devolución completada");
      load("");
    } catch {
      toast.error("Error al completar devolución");
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("¿Anular esta devolución?")) return;
    try {
      await cancelReturn(id);
      toast.success("Devolución anulada");
      load("");
    } catch {
      toast.error("Error al anular devolución");
    }
  }

  async function handleView(ret: ReturnWithRelations) {
    setViewingReturn(ret);
    try {
      const items = await getReturnItems(ret.id);
      setViewingItems(items);
    } catch {
      toast.error("Error al cargar detalles");
      setViewingItems([]);
    }
  }

  const filtered = searchQuery
    ? returns.filter((r: ReturnWithRelations) =>
        r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : returns;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[27px] font-marca text-[#5C3E35]">Devoluciones</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Gestión de devoluciones de productos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm">
          <Plus size={18} /> Nueva Devolución
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por número, cliente o factura..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <RotateCcw size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay devoluciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ret) => (
            <div key={ret.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-[#5C3E35]">{ret.return_number}</h3>
                    <Badge variant={STATUS_COLORS[ret.status] || "neutral"}>{ret.status === "DRAFT" ? "Borrador" : ret.status === "COMPLETED" ? "Completada" : "Anulada"}</Badge>
                  </div>
                  <p className="text-sm text-[#9C8A82]">{ret.clients?.full_name} — Factura {ret.invoices?.invoice_number}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-[#5C3E35] font-medium">{formatCurrency(ret.total)}</span>
                    <span className="text-[#9C8A82]">{formatDate(ret.return_date)}</span>
                    {ret.reason && <span className="text-[#9C8A82] truncate max-w-[200px]">{ret.reason}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handleView(ret)} className="p-2 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                  {ret.status === "DRAFT" && (
                    <>
                      <button onClick={() => handleComplete(ret.id)} className="p-2 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Completar"><Check size={16} /></button>
                      <button onClick={() => handleCancel(ret.id)} className="p-2 text-[#D4A0A0] hover:bg-red-50 rounded-lg transition-colors" title="Anular"><X size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Devolución" wide>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Factura</label>
            <select value={selectedInvoice?.id || ""} onChange={(e) => handleSelectInvoice(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
              <option value="">Seleccionar factura...</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.clients?.full_name || "Cliente"} — {formatCurrency(inv.total)}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <>
              <div className="border-t border-[#E8E0D8] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#5C3E35]">Productos a devolver</h4>
                  <select
                    onChange={(e) => {
                      if (e.target.value) { addReturnItem(e.target.value); e.target.value = ""; }
                    }}
                    disabled={loadingLines}
                    className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 disabled:opacity-50"
                  >
                    <option value="">{loadingLines ? "Cargando productos..." : "+ Agregar producto"}</option>
                    {invoiceLines
                      .filter((l) => !returnItems.some((i) => i.product_id === l.product_id))
                      .map((l) => (
                        <option key={l.product_id} value={l.product_id}>
                          {l.name} — {formatCurrency(l.unit_price)} — máx {l.returnable_quantity}
                        </option>
                      ))}
                  </select>
                </div>

                {invoiceLines.length === 0 && !loadingLines ? (
                  <p className="text-sm text-[#9C8A82] py-4 text-center">Esta factura no tiene productos para devolver</p>
                ) : returnItems.length === 0 ? (
                  <p className="text-sm text-[#9C8A82] py-4 text-center">Selecciona productos de la factura</p>
                ) : (
                  <div className="space-y-2">
                    {returnItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF6F0]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#5C3E35] truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="number" min={1} max={item.maxQty} value={item.quantity}
                              onChange={(e) => updateReturnItem(i, "quantity", Math.max(1, Number(e.target.value)))}
                              title={`Máximo ${item.maxQty} por devolver`}
                              className="w-16 h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-sm text-center text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                            <input type="number" step="0.01" value={item.unit_price}
                              onChange={(e) => updateReturnItem(i, "unit_price", Number(e.target.value))}
                              className="w-24 h-8 px-2 rounded-lg border border-[#E8E0D8] bg-white text-sm text-right text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                            <span className="text-sm font-medium text-[#5C3E35] w-24 text-right">{formatCurrency(item.line_total)}</span>
                          </div>
                        </div>
                        <button onClick={() => removeReturnItem(i)} className="p-1.5 text-[#D4A0A0] hover:bg-red-50 rounded-lg transition-colors"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 text-sm font-semibold text-[#5C3E35]">
                      <span>Total</span>
                      <span>{formatCurrency(returnItems.reduce((s, i) => s + i.line_total, 0))}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Motivo</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 transition-all resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas internas</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 transition-all resize-none" />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !selectedInvoice || returnItems.length === 0}
              className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Package size={18} /> {saving ? "Guardando..." : "Crear Devolución"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!viewingReturn} onClose={() => { setViewingReturn(null); setViewingItems([]); }}
        title={viewingReturn?.return_number || "Detalles"} wide>
        {viewingReturn && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant={STATUS_COLORS[viewingReturn.status] || "neutral"}>
                {viewingReturn.status === "DRAFT" ? "Borrador" : viewingReturn.status === "COMPLETED" ? "Completada" : "Anulada"}
              </Badge>
              <span className="text-sm text-[#9C8A82]">{formatDate(viewingReturn.return_date)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Cliente</label>
                <p className="text-sm text-[#5C3E35]">{viewingReturn.clients?.full_name || "N/A"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Factura</label>
                <p className="text-sm text-[#5C3E35]">{viewingReturn.invoices?.invoice_number || "N/A"}</p>
              </div>
            </div>

            {viewingReturn.reason && (
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Motivo</label>
                <p className="text-sm text-[#5C3E35]">{viewingReturn.reason}</p>
              </div>
            )}

            <div className="border-t border-[#E8E0D8] pt-4">
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Productos</h4>
              {viewingItems.length === 0 ? (
                <p className="text-sm text-[#9C8A82]">Cargando...</p>
              ) : (
                <div className="space-y-2">
                  {viewingItems.map((item: ReturnItemWithProduct) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0]">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#5C3E35]">{item.products?.name || "Producto"}</p>
                        <p className="text-xs text-[#9C8A82]">{item.products?.code || ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#5C3E35]">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                        <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(item.line_total)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-semibold text-[#5C3E35]">
                    <span>Total</span>
                    <span>{formatCurrency(viewingItems.reduce((s: number, i: ReturnItemWithProduct) => s + Number(i.line_total), 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {viewingReturn.notes && (
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Notas internas</label>
                <p className="text-sm text-[#5C3E35]">{viewingReturn.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {viewingReturn.status === "DRAFT" && (
                <>
                  <button onClick={() => { handleComplete(viewingReturn.id); setViewingReturn(null); }}
                    className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08E] transition-all flex items-center justify-center gap-2">
                    <Check size={18} /> Completar
                  </button>
                  <button onClick={() => { handleCancel(viewingReturn.id); setViewingReturn(null); }}
                    className="flex-1 h-12 border border-[#E8E0D8] text-[#D4A0A0] rounded-xl text-sm font-medium hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                    <X size={18} /> Anular
                  </button>
                </>
              )}
              <button onClick={() => { setViewingReturn(null); setViewingItems([]); }}
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
