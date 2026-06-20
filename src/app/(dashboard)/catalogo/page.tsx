"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getProducts, createProduct, updateProduct, searchProducts, getCategories, getSubbrands, createCategory, createSubbrand } from "@/services/products";
import type { Product, Category, Subbrand } from "@/types/database";
import { formatCurrency, roundToNearest50 } from "@/lib/utils";
import { BookOpen, Plus, Search, Upload, Edit2, Filter, Save, X, Brain } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const ITBIS_RATE = 0.18;

export default function CatalogoPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subbrands, setSubbrands] = useState<Subbrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [filterSubbrand, setFilterSubbrand] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "", name: "", description: "", benefits: "",
    cost: 0, pv: 0, category_id: "", subbrand_id: "",
  });

  const [showNewSubbrand, setShowNewSubbrand] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newSubbrandName, setNewSubbrandName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newForFilter, setNewForFilter] = useState<"subbrand" | "category" | null>(null);

  const fetchMeta = useCallback(async () => {
    const [cats, brands] = await Promise.all([getCategories(), getSubbrands()]);
    setCategories(cats);
    setSubbrands(brands);
  }, []);

  const load = useCallback(async (query: string, sb: string, cat: string) => {
    setLoading(true);
    try {
      let data;
      if (query) {
        data = await searchProducts(query);
      } else {
        data = await getProducts();
      }
      if (sb) data = data.filter((p: any) => p.subbrand_id === sb);
      if (cat) data = data.filter((p: any) => p.category_id === cat);
      setProducts(data);
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    load(searchQuery, filterSubbrand, filterCategory);
  }, [load, searchQuery, filterSubbrand, filterCategory]);

  function resetForm() {
    setForm({ code: "", name: "", description: "", benefits: "", cost: 0, pv: 0, category_id: "", subbrand_id: "" });
    setEditingProduct(null);
  }

  function openNew() { resetForm(); setShowModal(true); }

  function openEdit(product: any) {
    setEditingProduct(product);
    setForm({
      code: product.code, name: product.name, description: product.description || "",
      benefits: product.benefits || "", cost: product.cost, pv: product.pv,
      category_id: product.category_id || "", subbrand_id: product.subbrand_id || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Nombre y código son requeridos");
      return;
    }
    setSaving(true);
    try {
      const cost = Number(form.cost);
      const totalConItbis = cost * (1 + ITBIS_RATE);
      const productData: Record<string, any> = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        benefits: form.benefits || null,
        cost,
        pv: form.pv,
        category_id: form.category_id || null,
        subbrand_id: form.subbrand_id || null,
        price_30: roundToNearest50(totalConItbis * 1.3),
        price_35: roundToNearest50(totalConItbis * 1.35),
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData as any);
        toast.success("Producto actualizado");
      } else {
        await createProduct(productData as any);
        toast.success("Producto creado");
      }
      setShowModal(false);
      resetForm();
      load(searchQuery, filterSubbrand, filterCategory);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar producto");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubbrand(name: string) {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      const sb = await createSubbrand(name.trim());
      setSubbrands(prev => [...prev, sb]);
      if (newForFilter === "subbrand") setFilterSubbrand(sb.id);
      else setForm(prev => ({ ...prev, subbrand_id: sb.id }));
      setNewSubbrandName("");
      setShowNewSubbrand(false);
      setNewForFilter(null);
      toast.success("Submarca creada");
    } catch { toast.error("Error al crear submarca"); }
  }

  async function handleCreateCategory(name: string) {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      const cat = await createCategory(name.trim());
      setCategories(prev => [...prev, cat]);
      if (newForFilter === "category") setFilterCategory(cat.id);
      else setForm(prev => ({ ...prev, category_id: cat.id }));
      setNewCategoryName("");
      setShowNewCategory(false);
      setNewForFilter(null);
      toast.success("Categoría creada");
    } catch { toast.error("Error al crear categoría"); }
  }

  async function handleImportPdf() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      toast.success("PDF seleccionado. La importación se procesará cuando Supabase esté configurado.");
    };
    input.click();
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Catálogo de Productos</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Base de datos de productos Amway</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push("/recomendaciones")} className="flex items-center gap-2 bg-white border border-[#E8E0D8] text-[#5C3E35] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all duration-200">
            <Brain size={18} /> IA Recomendaciones
          </button>
          <button onClick={handleImportPdf} className="flex items-center gap-2 bg-white border border-[#E8E0D8] text-[#5C3E35] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all duration-200">
            <Upload size={18} /> Importar PDF
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm">
            <Plus size={18} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar producto por nombre o código..." className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`h-12 px-4 rounded-xl border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${showFilters || filterSubbrand || filterCategory ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]" : "border-[#E8E0D8] text-[#9C8A82] hover:bg-[#FAF6F0]"}`}>
          <Filter size={18} /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-4 mb-6 p-4 bg-white rounded-2xl border border-[#E8E0D8]">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Submarca</label>
            <select value={filterSubbrand} onChange={(e) => {
              if (e.target.value === "__new__") { setNewForFilter("subbrand"); setShowNewSubbrand(true); return; }
              setFilterSubbrand(e.target.value);
            }} className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
              <option value="">Todas</option>
              {subbrands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new__">+ Otra...</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Categoría</label>
            <select value={filterCategory} onChange={(e) => {
              if (e.target.value === "__new__") { setNewForFilter("category"); setShowNewCategory(true); return; }
              setFilterCategory(e.target.value);
            }} className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new__">+ Otra...</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]"><BookOpen size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">No hay productos registrados</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => {
            const itbis = product.cost * ITBIS_RATE;
            const total = product.cost + itbis;
            const p30 = roundToNearest50(total * 1.3);
            const p35 = roundToNearest50(total * 1.35);
            return (
              <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-[#5C3E35]">{product.name}</h3>
                    <p className="text-xs text-[#9C8A82] mt-0.5">{product.code}</p>
                  </div>
                  <button onClick={() => openEdit(product)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors"><Edit2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {product.subbrands && <Badge variant="info">{product.subbrands.name}</Badge>}
                  {product.categories && <Badge variant="neutral">{product.categories.name}</Badge>}
                  {!product.active && <Badge variant="danger">Inactivo</Badge>}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[#9C8A82]">Costo Amway</span><span className="font-medium">{formatCurrency(product.cost)}</span></div>
                  <div className="flex justify-between"><span className="text-[#9C8A82]">ITBIS (18%)</span><span className="font-medium">{formatCurrency(itbis)}</span></div>
                  <div className="flex justify-between border-b border-[#E8E0D8] pb-1.5 mb-1.5"><span className="text-[#9C8A82]">Total</span><span className="font-bold text-[#5C3E35]">{formatCurrency(total)}</span></div>
                  <div className="flex justify-between"><span className="text-[#9C8A82]">Precio 30%</span><span className="font-medium text-[#B8837E]">{formatCurrency(p30)}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">Precio 35%</span>
                    <div className="text-right">
                      <span className="font-medium text-[#B8837E]">{formatCurrency(p35)}</span>
                      <span className="text-[10px] text-[#BFB0A8] ml-1">({formatCurrency(product.cost * ITBIS_RATE + product.cost)} x 1.35 = {formatCurrency((product.cost * ITBIS_RATE + product.cost) * 1.35)})</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingProduct ? "Editar Producto" : "Nuevo Producto"} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Código *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A12345" readOnly={!!editingProduct} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del producto" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Submarca</label>
              <select value={form.subbrand_id} onChange={(e) => {
                if (e.target.value === "__new__") { setNewForFilter(null); setShowNewSubbrand(true); return; }
                setForm({ ...form, subbrand_id: e.target.value });
              }} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
                <option value="">Seleccionar...</option>
                {subbrands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="__new__">+ Crear nueva...</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Categoría</label>
              <select value={form.category_id} onChange={(e) => {
                if (e.target.value === "__new__") { setNewForFilter(null); setShowNewCategory(true); return; }
                setForm({ ...form, category_id: e.target.value });
              }} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all">
                <option value="">Seleccionar...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Crear nueva...</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Costo Amway (RD$)</label>
              <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">PV</label>
              <input type="number" step="0.01" value={form.pv} onChange={(e) => setForm({ ...form, pv: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio 30%</label>
              <input type="number" step="0.01" value={roundToNearest50(Number(form.cost) * (1 + ITBIS_RATE) * 1.3) || 0} readOnly className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FAF6F0] text-[#9C8A82] text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNewSubbrand} onClose={() => { setShowNewSubbrand(false); setNewSubbrandName(""); setNewForFilter(null); }} title="Nueva Submarca">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre de la submarca</label>
            <input type="text" value={newSubbrandName} onChange={(e) => setNewSubbrandName(e.target.value)} placeholder="Ej: Nutrilite" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowNewSubbrand(false); setNewSubbrandName(""); setNewForFilter(null); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={() => handleCreateSubbrand(newSubbrandName)} disabled={!newSubbrandName.trim()} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">Crear</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNewCategory} onClose={() => { setShowNewCategory(false); setNewCategoryName(""); setNewForFilter(null); }} title="Nueva Categoría">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre de la categoría</label>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Vitaminas" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowNewCategory(false); setNewCategoryName(""); setNewForFilter(null); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={() => handleCreateCategory(newCategoryName)} disabled={!newCategoryName.trim()} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">Crear</button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
