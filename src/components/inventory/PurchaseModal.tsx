"use client";

import Modal from "@/components/ui/Modal";
import PurchasePdfImport from "@/components/purchases/PurchasePdfImport";
import { normalize } from "@/lib/search";
import { formatCurrency } from "@/lib/utils";
import { ITBIS_RATE } from "@/lib/constants";
import { Search, X, Plus, Upload, ChevronDown, Save } from "lucide-react";

interface PurchaseFormItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
  itbis?: boolean;
}

interface PurchaseForm {
  supplier_name: string;
  purchase_date: string;
  notes: string;
  discount_amount: number;
  impuesto_recogida: number;
  cargo_administracion: number;
  payment_method: string;
  bank_account_id: string;
  items: PurchaseFormItem[];
}

interface PurchaseModalProps {
  isOpen: boolean;
  editing: boolean;
  saving: boolean;
  form: PurchaseForm;
  suppliers: Array<{ id: string; name: string; city?: string }>;
  bankAccounts: Array<{ id: string; bank_name: string; account_type: string; account_number: string }>;
  products: Array<{ id: string; name: string; cost?: number | null }>;
  showSupplierDropdown: boolean;
  supplierSearch: string;
  showPdfImport: boolean;
  showProductSearch: boolean;
  productSearch: string;
  productFiltered: Array<{ id: string; name: string; cost?: number | null }>;
  subtotal: number;
  itbis: number;
  total: number;
  setForm: (f: PurchaseForm) => void;
  setSupplierSearch: (v: string) => void;
  setShowSupplierDropdown: (v: boolean) => void;
  setShowPdfImport: (v: boolean) => void;
  setShowProductSearch: (v: boolean) => void;
  setProductSearch: (v: string) => void;
  onApplyPdf: (purchase: any) => void;
  addProduct: (p: { id: string; name: string; cost?: number | null }) => void;
  updateItem: (i: number, field: string, value: any) => void;
  removeItem: (i: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function PurchaseModal({
  isOpen,
  editing,
  saving,
  form,
  suppliers,
  bankAccounts,
  products,
  showSupplierDropdown,
  supplierSearch,
  showPdfImport,
  showProductSearch,
  productSearch,
  productFiltered,
  subtotal,
  itbis,
  total,
  setForm,
  setSupplierSearch,
  setShowSupplierDropdown,
  setShowPdfImport,
  setShowProductSearch,
  setProductSearch,
  onApplyPdf,
  addProduct,
  updateItem,
  removeItem,
  onClose,
  onSubmit,
}: PurchaseModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? "Editar Compra" : "Registrar Compra"} wide>
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
                  {suppliers.filter(s => !supplierSearch || normalize(s.name).includes(normalize(supplierSearch))).map((s) => (
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
                  {suppliers.filter(s => !supplierSearch || normalize(s.name).includes(normalize(supplierSearch))).length === 0 && (
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descuento (RD$)</label>
            <input
              type="number" step="0.01" min={0} value={form.discount_amount}
              onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })}
              placeholder="0"
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Forma de Pago</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            >
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
              <option>Cheque</option>
              <option>Otro</option>
            </select>
          </div>
        </div>

        {form.payment_method === "Transferencia" && (
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cuenta Bancaria</label>
            <select
              value={form.bank_account_id}
              onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
            >
              <option value="">Seleccionar banco...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.account_type} — No. {b.account_number}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-[#5C3E35]">Productos</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPdfImport(!showPdfImport)}
                className="text-xs text-[#B8837E] hover:underline flex items-center gap-1"
              >
                <Upload size={14} />
                Subir PDF
              </button>
              <button
                onClick={() => setShowProductSearch(!showProductSearch)}
                className="text-xs text-[#B8837E] hover:underline flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar producto
              </button>
            </div>
          </div>

          {showPdfImport && (
            <div className="mb-4">
              <PurchasePdfImport
                products={products}
                onApply={onApplyPdf}
                onClose={() => setShowPdfImport(false)}
              />
            </div>
          )}

          {showProductSearch && (
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
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {form.items.map((item, i) => {
                const lineSubtotal = item.quantity * item.unit_cost;
                const hasItbis = item.itbis !== false;
                const lineItbis = Math.round((hasItbis ? 1 : 0) * lineSubtotal * ITBIS_RATE * 100) / 100;
                const lineTotal = lineSubtotal + lineItbis;
                return (
                  <div key={i} className="flex items-center gap-3 bg-[#FAF6F0] rounded-xl p-3">
                    <div className="flex-1 text-sm text-[#5C3E35] truncate">{item.name}</div>
                    <button
                      type="button"
                      onClick={() => updateItem(i, "itbis", !hasItbis)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${hasItbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasItbis ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
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
                    <span className="text-xs text-[#9C8A82] w-20 text-center">{formatCurrency(lineItbis)}</span>
                    <span className="text-sm font-medium text-[#5C3E35] w-24 text-right">{formatCurrency(lineTotal)}</span>
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
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#9C8A82]">Impuesto de Recogida</span>
            <input type="number" step="0.01" value={form.impuesto_recogida}
              onChange={(e) => setForm({ ...form, impuesto_recogida: Number(e.target.value) })}
              className="w-24 h-7 px-2 text-right rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#9C8A82]">Cargo de Administración (Detalle)</span>
            <input type="number" step="0.01" value={form.cargo_administracion}
              onChange={(e) => setForm({ ...form, cargo_administracion: Number(e.target.value) })}
              className="w-24 h-7 px-2 text-right rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9C8A82]">ITBIS (18%)</span>
            <span className="text-[#5C3E35]">{formatCurrency(itbis)}</span>
          </div>
          {form.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#D4A0A0]">Descuento</span>
              <span className="text-[#D4A0A0]">-{formatCurrency(form.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-[#E8E0D8] pt-1.5 mt-1.5">
            <span>Total</span>
            <span className="text-[#B8837E]">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={onSubmit} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Registrar Compra"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
