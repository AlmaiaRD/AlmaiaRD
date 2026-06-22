"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { getProducts } from "@/services/products";
import { getSuppliers } from "@/services/suppliers";
import { createPurchase, getPurchases, getPurchase, updatePurchase, deletePurchase } from "@/services/purchases";
import { getSettings } from "@/services/settings";
import type { Supplier, Settings } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Eye, Edit2, Trash2, X, Save, Printer, Download, ChevronDown, FileText } from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

const ITBIS_RATE = 0.18;

interface FormItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
  itbis: boolean;
}

interface PurchaseForm {
  supplier_name: string;
  purchase_date: string;
  notes: string;
  items: FormItem[];
}

const emptyForm: PurchaseForm = {
  supplier_name: "",
  purchase_date: new Date().toISOString().split("T")[0],
  notes: "",
  items: [],
};

function generatePurchasePdf(purchase: any, settings?: Settings | null) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = 216;
  let y = 30;
  const margin = 20;

  function setTextColor(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  }

  function line(x1: number, y1: number, x2: number, y2: number, color: string) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    doc.setDrawColor(r, g, b);
    doc.line(x1, y1, x2, y2);
  }

  setTextColor("#5C3E35");
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("COMPRA", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setTextColor("#9C8A82");
  doc.text(`No. ${purchase.purchase_number}`, margin, y + 7);

  y += 18;

  line(margin, y, pageW - margin, y, "#E8E0D8");
  y += 8;

  doc.setFontSize(10);
  setTextColor("#5C3E35");
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(purchase.purchase_date), margin + 20, y);

  doc.setFont("helvetica", "bold");
  doc.text("Proveedor:", margin + 80, y);
  doc.setFont("helvetica", "normal");
  doc.text(purchase.supplier_name || "—", margin + 105, y);

  y += 10;

  if (purchase.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(purchase.notes, margin + 20, y);
    y += 8;
  }

  y += 4;

  line(margin, y, pageW - margin, y, "#E8E0D8");
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor("#9C8A82");
  const colW = [55, 25, 25, 25, 25, 25];
  const colX = [margin];
  for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);
  doc.text("Producto", colX[0], y);
  doc.text("Cant.", colX[1], y, { align: "center" });
  doc.text("Costo U.", colX[2], y, { align: "center" });
  doc.text("ITBIS", colX[3], y, { align: "center" });
  doc.text("Subtotal", colX[4], y, { align: "center" });
  doc.text("Total", colX[5], y, { align: "right" });

  y += 8;
  line(colX[0], y, pageW - margin, y, "#E8E0D8");
  y += 4;

  doc.setFont("helvetica", "normal");
  setTextColor("#5C3E35");
  doc.setFontSize(9);

  (purchase.purchase_items || []).forEach((item: any) => {
    if (y > 250) {
      doc.addPage();
      y = 30;
    }
    const lineItbis = item.quantity * item.unit_cost * ITBIS_RATE;
    const lineTotal = item.line_total + lineItbis;
    doc.text(item.products?.name || "—", colX[0], y);
    doc.text(String(item.quantity), colX[1], y, { align: "center" });
    doc.text(formatCurrency(item.unit_cost), colX[2], y, { align: "center" });
    doc.text(formatCurrency(lineItbis), colX[3], y, { align: "center" });
    doc.text(formatCurrency(item.line_total), colX[4], y, { align: "center" });
    doc.text(formatCurrency(lineTotal), colX[5], y, { align: "right" });
    y += 7;
  });

  y += 4;
  line(margin, y, pageW - margin, y, "#E8E0D8");
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  setTextColor("#5C3E35");
  doc.text("Subtotal:", pageW - margin - 60, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(formatCurrency(purchase.subtotal), pageW - margin, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("ITBIS (18%):", pageW - margin - 60, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(formatCurrency(purchase.itbis || 0), pageW - margin, y, { align: "right" });
  y += 7;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setTextColor("#B8837E");
  doc.text("TOTAL:", pageW - margin - 60, y, { align: "right" });
  doc.text(formatCurrency(purchase.total), pageW - margin, y, { align: "right" });

  y += 20;
  line(margin, y, pageW - margin, y, "#E8E0D8");
  y += 8;
  setTextColor("#9C8A82");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Documento generado por ${settings?.business_name || "Almaia RD"}`, margin, y);

  doc.setFontSize(8);
  setTextColor("#B8837E");
  doc.text(`${settings?.business_name || "Almaia RD"} - ${formatDate(new Date().toISOString())}`, pageW - margin, y, { align: "right" });

  doc.save(`COMPRA-${purchase.purchase_number}.pdf`);
}

export default function ComprasPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PurchaseForm>({ ...emptyForm });

  const [showDetail, setShowDetail] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const productFiltered = useMemo(() =>
    products.filter(p => p.active && (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase())))),
    [products, productSearch]
  );

  const purchasesFiltered = useMemo(() => {
    if (!searchQuery) return purchases;
    const q = searchQuery.toLowerCase();
    return purchases.filter(p =>
      p.purchase_number.toLowerCase().includes(q) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
    );
  }, [purchases, searchQuery]);

  const load = useCallback(async () => {
    try {
      const [pur, pr, sup, st] = await Promise.all([getPurchases(), getProducts(), getSuppliers(), getSettings().catch(() => null)]);
      setPurchases(pur);
      setProducts(pr);
      setSuppliers(sup);
      setSettings(st);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ ...emptyForm, purchase_date: new Date().toISOString().split("T")[0] });
    setEditingId(null);
    setProductSearch("");
  }

  function openEdit(purchase: any) {
    setEditingId(purchase.id);
    setForm({
      supplier_name: purchase.supplier_name || "",
      purchase_date: purchase.purchase_date,
      notes: purchase.notes || "",
      items: (purchase.purchase_items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.products?.name || "—",
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        itbis: i.itbis ?? true,
      })),
    });
    setShowForm(true);
  }

  function addProduct(product: any) {
    if (form.items.some(i => i.product_id === product.id)) {
      toast.error("El producto ya está en la lista");
      return;
    }
    setForm({
      ...form,
      items: [...form.items, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_cost: product.cost || 0,
        itbis: true,
      }],
    });
    setShowProducts(false);
    setProductSearch("");
  }

  function removeItem(index: number) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  }

  function updateItem(index: number, field: keyof FormItem, value: any) {
    const items = [...form.items];
    (items[index] as any)[field] = value;
    setForm({ ...form, items });
  }

  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const itbisTotal = Math.round(form.items.reduce((s, i) => s + (i.itbis ? i.quantity * i.unit_cost * ITBIS_RATE : 0), 0) * 100) / 100;
  const grandTotal = subtotal + itbisTotal;

  async function handleSave() {
    if (!form.purchase_date) { toast.error("Selecciona la fecha de la compra"); return; }
    if (form.items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updatePurchase(editingId, {
          supplier_name: form.supplier_name,
          purchase_date: form.purchase_date,
          notes: form.notes,
          items: form.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost, itbis: i.itbis })),
        });
        toast.success("Compra actualizada exitosamente");
      } else {
        await createPurchase({
          supplier_name: form.supplier_name,
          purchase_date: form.purchase_date,
          notes: form.notes,
          items: form.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost, itbis: i.itbis })),
        });
        toast.success("Compra registrada exitosamente");
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar la compra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePurchase(id);
      toast.success("Compra eliminada");
      setShowConfirmDelete(null);
      load();
    } catch {
      toast.error("Error al eliminar la compra");
    }
  }

  async function handleView(id: string) {
    try {
      const pur = await getPurchase(id);
      setSelectedPurchase(pur);
      setShowDetail(true);
    } catch {
      toast.error("Error al cargar la compra");
    }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Compras</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Historial de compras y abastecimiento</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm"
        >
          <Plus size={18} />
          Nueva Compra
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por número o proveedor..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : purchasesFiltered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <p className="text-sm">{searchQuery ? "No se encontraron compras" : "No hay compras registradas"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchasesFiltered.map((pur) => (
            <div
              key={pur.id}
              className="bg-white rounded-xl p-4 border border-[#E8E0D8] shadow-sm flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-[#FAF6F0] flex items-center justify-center text-[#B8837E] shrink-0">
                <span className="text-xs font-bold">{pur.purchase_number?.replace(settings?.purchase_prefix || "COM-", "")}</span>
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#9C8A82] text-xs">Fecha</p>
                  <p className="text-[#5C3E35] font-medium">{formatDate(pur.purchase_date)}</p>
                </div>
                <div>
                  <p className="text-[#9C8A82] text-xs">Proveedor</p>
                  <p className="text-[#5C3E35] truncate">{pur.supplier_name || "—"}</p>
                </div>
                <div>
                  <p className="text-[#9C8A82] text-xs">ITBIS</p>
                  <p className="text-[#5C3E35]">{formatCurrency(pur.itbis || 0)}</p>
                </div>
                <div>
                  <p className="text-[#9C8A82] text-xs">Total</p>
                  <p className="text-[#B8837E] font-bold">{formatCurrency(pur.total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleView(pur.id)}
                  className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                  title="Ver detalle"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => openEdit(pur)}
                  className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => generatePurchasePdf(pur, settings)}
                  className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                  title="Imprimir / PDF"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setShowConfirmDelete(pur.id)}
                  className="p-2 text-[#D4A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? "Editar Compra" : "Nueva Compra"} wide>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha de la compra</label>
              <input
                type="date" value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Proveedor</label>
              <div className="relative">
                <input
                  type="text" value={form.supplier_name}
                  onChange={(e) => { setForm({ ...form, supplier_name: e.target.value }); setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="Buscar o escribir proveedor..."
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                />
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9C8A82] pointer-events-none" />
              </div>
              {showSupplierDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSupplierDropdown(false)} />
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#E8E0D8] shadow-lg max-h-48 overflow-y-auto">
                    {suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setForm({ ...form, supplier_name: s.name }); setShowSupplierDropdown(false); setSupplierSearch(""); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-colors flex justify-between"
                      >
                        <span>{s.name}</span>
                        {s.city && <span className="text-[#9C8A82] text-xs">{s.city}</span>}
                      </button>
                    ))}
                    {suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-sm text-[#9C8A82]">Sin resultados. Escribe para agregar uno nuevo.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#5C3E35]">Productos</label>
              <button
                onClick={() => setShowProducts(!showProducts)}
                className="text-xs text-[#B8837E] hover:underline flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar producto
              </button>
            </div>

            {showProducts && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl overflow-hidden">
                <div className="p-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                    <input
                      type="text" value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-0.5">
                  {productFiltered.length === 0 ? (
                    <p className="text-sm text-[#9C8A82] py-3 text-center">Sin resultados</p>
                  ) : productFiltered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm text-[#5C3E35] hover:bg-white rounded-lg transition-colors flex justify-between"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[#9C8A82] shrink-0 ml-2">{formatCurrency(p.cost || 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.items.length === 0 ? (
              <p className="text-sm text-[#9C8A82] py-3">No hay productos agregados</p>
            ) : (
              <div className="space-y-2">
                {form.items.map((item, i) => {
                  const lineSubtotal = item.quantity * item.unit_cost;
                  const lineItbis = item.itbis ? Math.round(lineSubtotal * ITBIS_RATE * 100) / 100 : 0;
                  const lineTotal = lineSubtotal + lineItbis;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-[#FAF6F0] rounded-xl p-3">
                      <div className="flex-1 text-sm text-[#5C3E35] truncate">{item.name}</div>
                      <input
                        type="number" min={1} value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", Math.max(1, Number(e.target.value)))}
                        className="w-16 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                      <input
                        type="number" step="0.01" min={0} value={item.unit_cost}
                        onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))}
                        className="w-24 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(i, "itbis", !item.itbis)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${item.itbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${item.itbis ? "translate-x-6" : "translate-x-0.5"}`} />
                      </button>
                      <span className={`text-xs w-20 text-center ${item.itbis ? "text-[#9C8A82]" : "text-[#D4A0A0]"}`}>{formatCurrency(lineItbis)}</span>
                      <span className={`text-sm font-medium w-24 text-right ${item.itbis ? "text-[#5C3E35]" : "text-[#9C8A82]"}`}>{formatCurrency(lineTotal)}</span>
                      <button onClick={() => removeItem(i)} className="p-1 text-[#D4A0A0] hover:bg-white rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#9C8A82]">Subtotal</span>
              <span className="text-[#5C3E35]">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9C8A82]">ITBIS (18%)</span>
              <span className="text-[#5C3E35]">{formatCurrency(itbisTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[#E8E0D8] pt-1.5 mt-1.5">
              <span>Total</span>
              <span className="text-[#B8837E]">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
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
              {saving ? "Guardando..." : editingId ? "Actualizar Compra" : "Registrar Compra"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedPurchase(null); }} title="Detalle de Compra" wide>
        {selectedPurchase && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[#9C8A82] text-xs">Número</p>
                <p className="text-[#5C3E35] font-medium">{selectedPurchase.purchase_number}</p>
              </div>
              <div>
                <p className="text-[#9C8A82] text-xs">Fecha</p>
                <p className="text-[#5C3E35]">{formatDate(selectedPurchase.purchase_date)}</p>
              </div>
              <div>
                <p className="text-[#9C8A82] text-xs">Proveedor</p>
                <p className="text-[#5C3E35]">{selectedPurchase.supplier_name || "—"}</p>
              </div>
            </div>

            {selectedPurchase.notes && (
              <div className="text-sm">
                <p className="text-[#9C8A82] text-xs mb-1">Notas</p>
                <p className="text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3">{selectedPurchase.notes}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-[#5C3E35] mb-2">Productos</p>
              <div className="bg-[#FAF6F0] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9C8A82] text-xs border-b border-[#E8E0D8]">
                      <th className="text-left py-3 px-4">Producto</th>
                      <th className="text-center py-3 px-4">Cant.</th>
                      <th className="text-center py-3 px-4">Costo U.</th>
                      <th className="text-center py-3 px-4">ITBIS</th>
                      <th className="text-center py-3 px-4">Subtotal</th>
                      <th className="text-right py-3 px-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.purchase_items?.map((item: any, i: number) => {
                      const lineItbis = item.line_itbis || Math.round(item.quantity * item.unit_cost * ITBIS_RATE * 100) / 100;
                      const lineTotal = item.line_total + lineItbis;
                      return (
                        <tr key={i} className="border-b border-[#E8E0D8] last:border-0">
                          <td className="py-3 px-4 text-[#5C3E35]">{item.products?.name || "—"}</td>
                          <td className="py-3 px-4 text-center text-[#5C3E35]">{item.quantity}</td>
                          <td className="py-3 px-4 text-center text-[#5C3E35]">{formatCurrency(item.unit_cost)}</td>
                          <td className="py-3 px-4 text-center text-[#5C3E35]">{formatCurrency(lineItbis)}</td>
                          <td className="py-3 px-4 text-center text-[#5C3E35]">{formatCurrency(item.line_total)}</td>
                          <td className="py-3 px-4 text-right text-[#5C3E35] font-medium">{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#9C8A82]">Subtotal</span>
                <span className="text-[#5C3E35]">{formatCurrency(selectedPurchase.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9C8A82]">ITBIS (18%)</span>
                <span className="text-[#5C3E35]">{formatCurrency(selectedPurchase.itbis || 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-[#E8E0D8] pt-1.5 mt-1.5">
                <span>Total</span>
                <span className="text-[#B8837E]">{formatCurrency(selectedPurchase.total)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDetail(false); }}
                className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
              >
                Cerrar
              </button>
              <button
                onClick={() => { generatePurchasePdf(selectedPurchase, settings); }}
                className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Descargar PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!showConfirmDelete} onClose={() => setShowConfirmDelete(null)} title="Confirmar Eliminación">
        <div className="space-y-5">
          <p className="text-sm text-[#5C3E35]">¿Estás seguro de eliminar esta compra? Esta acción no se puede deshacer.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmDelete(null)}
              className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => showConfirmDelete && handleDelete(showConfirmDelete)}
              className="flex-1 h-12 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}