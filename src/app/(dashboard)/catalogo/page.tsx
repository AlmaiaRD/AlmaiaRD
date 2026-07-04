"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import { getProducts, createProduct, updateProduct, searchProducts, getCategories, getSubbrands, createCategory, createSubbrand, deactivateSubbrand, deactivateCategory } from "@/services/products";
import { getSettings } from "@/services/settings";
import type { Product, Category, Subbrand, Settings } from "@/types/database";
import { formatCurrency, roundToNearest50 } from "@/lib/utils";
import { BookOpen, Plus, Search, Upload, Edit2, Filter, Save, X, Brain, Trash2, Settings as SettingsIcon, Archive, RotateCcw, Eye, EyeOff } from "lucide-react";
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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [form, setForm] = useState({
    code: "", name: "", description: "", benefits: "",
    cost: 0, pv: 0, price_30: 0, price_35: 0, apply_itbis: true, category_id: "", subbrand_id: "",
    duracion_dias: null as number | null,
  });

  const [showNewSubbrand, setShowNewSubbrand] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newSubbrandName, setNewSubbrandName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newForFilter, setNewForFilter] = useState<"subbrand" | "category" | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ id: string; field: "price_30" | "price_35"; value: number } | null>(null);
  const [savingItbis, setSavingItbis] = useState<string | null>(null);
  const [showManageSubbrands, setShowManageSubbrands] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [deletingSubbrand, setDeletingSubbrand] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);

  const fetchMeta = useCallback(async () => {
    const [cats, brands, st] = await Promise.all([getCategories(), getSubbrands(), getSettings().catch(() => null)]);
    setCategories(cats);
    setSubbrands(brands);
    if (st) setSettings(st);
  }, []);

  const load = useCallback(async (query: string, sb: string, cat: string) => {
    setLoading(true);
    try {
      let data;
      if (query) {
        data = await searchProducts(query);
      } else {
        data = await getProducts(true);
      }
      if (sb) data = data.filter((p: any) => p.subbrand_id === sb);
      if (cat) data = data.filter((p: any) => p.category_id === cat);
      setProducts(showArchived ? data.filter((p: any) => !p.active) : data.filter((p: any) => p.active));
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    load(searchQuery, filterSubbrand, filterCategory);
  }, [load, searchQuery, filterSubbrand, filterCategory]);

  function resetForm() {
    setForm({ code: "", name: "", description: "", benefits: "", cost: 0, pv: 0, price_30: 0, price_35: 0, apply_itbis: true, category_id: "", subbrand_id: "", duracion_dias: null });
    setEditingProduct(null);
  }

  function openNew() { resetForm(); setShowModal(true); }

  function openEdit(product: any) {
    setEditingProduct(product);
    setForm({
      code: product.code, name: product.name, description: product.description || "",
      benefits: product.benefits || "", cost: product.cost, pv: product.pv,
      price_30: product.price_30 || 0, price_35: product.price_35 || 0,
      apply_itbis: product.apply_itbis !== false,
      category_id: product.category_id || "", subbrand_id: product.subbrand_id || "",
      duracion_dias: product.duracion_dias || null,
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
      const totalBase = cost * (form.apply_itbis !== false ? (1 + ITBIS_RATE) : 1);
      const auto30 = roundToNearest50(totalBase * 1.3);
      const auto35 = roundToNearest50(totalBase * 1.35);
      const productData: Record<string, any> = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        benefits: form.benefits || null,
        cost,
        pv: form.pv,
        apply_itbis: form.apply_itbis !== false,
        category_id: form.category_id || null,
        subbrand_id: form.subbrand_id || null,
        price_30: Number(form.price_30) || auto30,
        price_35: Number(form.price_35) || auto35,
        duracion_dias: form.duracion_dias || null,
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

  async function handlePriceSave() {
    if (!editingPrice) return;
    const { id, field, value } = editingPrice;
    if (value < 0) { toast.error("El precio no puede ser negativo"); return; }
    try {
      await updateProduct(id, { [field]: value } as any);
      setProducts((prev: any[]) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
      setEditingPrice(null);
    } catch { toast.error("Error al actualizar precio"); }
  }

  async function handleToggleItbis(product: any) {
    const newVal = !(product.apply_itbis !== false);
    setSavingItbis(product.id);
    try {
      await updateProduct(product.id, { apply_itbis: newVal } as any);
      setProducts((prev: any[]) => prev.map((p) => (p.id === product.id ? { ...p, apply_itbis: newVal } : p)));
    } catch { toast.error("Error al actualizar ITBIS"); }
    finally { setSavingItbis(null); }
  }

  async function handleArchiveProduct(product: any) {
    if (!confirm(`¿Archivar "${product.name}"?`)) return;
    try {
      await updateProduct(product.id, { active: false } as any);
      setProducts((prev: any[]) => prev.filter((p) => p.id !== product.id));
      toast.success("Producto archivado");
    } catch { toast.error("Error al archivar producto"); }
  }

  async function handleRestoreProduct(product: any) {
    try {
      await updateProduct(product.id, { active: true } as any);
      setProducts((prev: any[]) => prev.map((p) => (p.id === product.id ? { ...p, active: true } : p)));
      toast.success("Producto restaurado");
    } catch { toast.error("Error al restaurar producto"); }
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
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`h-12 px-4 rounded-xl border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${showArchived ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]" : "border-[#E8E0D8] text-[#9C8A82] hover:bg-[#FAF6F0]"}`}
          >
            <Archive size={18} /> {showArchived ? "Ocultar archivados" : "Ver archivados"}
          </button>
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
        {settings && (
          <div className="flex items-center gap-2 px-4 h-12 rounded-xl border border-[#E8E0D8] bg-white text-sm">
            <span className="text-[#9C8A82] whitespace-nowrap">Nutrilite ITBIS</span>
            <button
              type="button"
              onClick={async () => {
                const newVal = !settings.nutrilite_itbis_enabled;
                setSettings({ ...settings, nutrilite_itbis_enabled: newVal });
                const { error } = await supabase.from("settings").update({ nutrilite_itbis_enabled: newVal }).eq("id", settings.id);
                if (error) { toast.error("Error al guardar"); setSettings(settings); }
                else toast.success(newVal ? "ITBIS activado para Nutrilite" : "ITBIS desactivado para Nutrilite");
              }}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.nutrilite_itbis_enabled ? "bg-[#B8837E]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.nutrilite_itbis_enabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        )}
        <button onClick={() => setShowFilters(!showFilters)} className={`h-12 px-4 rounded-xl border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${showFilters || filterSubbrand || filterCategory ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]" : "border-[#E8E0D8] text-[#9C8A82] hover:bg-[#FAF6F0]"}`}>
          <Filter size={18} /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-4 mb-6 p-4 bg-white rounded-2xl border border-[#E8E0D8]">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#9C8A82] mb-1 flex items-center gap-1">
              Submarca
              <button onClick={() => setShowManageSubbrands(true)} className="text-[#B8837E] hover:text-[#9A6B66]" title="Gestionar submarcas">
                <SettingsIcon size={14} />
              </button>
            </label>
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
            <label className="block text-xs font-medium text-[#9C8A82] mb-1 flex items-center gap-1">
              Categoría
              <button onClick={() => setShowManageCategories(true)} className="text-[#B8837E] hover:text-[#9A6B66]" title="Gestionar categorías">
                <SettingsIcon size={14} />
              </button>
            </label>
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
            return (
              <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-[#5C3E35]">{product.name}</h3>
                    <p className="text-xs text-[#9C8A82] mt-0.5">{product.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewingProduct(product)} className="p-2 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Ver detalles"><Eye size={14} /></button>
                    <button onClick={() => openEdit(product)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors"><Edit2 size={14} /></button>
                    {!product.active ? (
                      <button onClick={() => handleRestoreProduct(product)} className="p-2 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Restaurar"><RotateCcw size={14} /></button>
                    ) : (
                      <button onClick={() => handleArchiveProduct(product)} className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Archivar"><Archive size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {product.subbrands && <Badge variant="info">{product.subbrands.name}</Badge>}
                  {product.categories && <Badge variant="neutral">{product.categories.name}</Badge>}
                  {!product.active && <Badge variant="danger">Inactivo</Badge>}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[#9C8A82]">Costo Amway</span><span className="font-medium">{formatCurrency(product.cost)}</span></div>
                  {product.apply_itbis !== false && (
                    <div className="flex justify-between border-b border-[#E8E0D8] pb-1.5 mb-1.5"><span className="text-[#9C8A82]">Costo + ITBIS</span><span className="font-bold text-[#5C3E35]">{formatCurrency(product.cost * (1 + ITBIS_RATE))}</span></div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">30% exacto</span>
                    <span className="font-medium text-[#9C8A82]">{formatCurrency(product.cost * (product.apply_itbis !== false ? (1 + ITBIS_RATE) : 1) * 1.3)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">30% redondeado</span>
                    {editingPrice?.id === product.id && editingPrice?.field === "price_30" ? (
                      <input type="number" step="0.01" value={editingPrice.value} autoFocus
                        onChange={(e) => setEditingPrice({ ...editingPrice, value: Number(e.target.value) })}
                        onBlur={handlePriceSave}
                        onKeyDown={(e) => { if (e.key === "Enter") handlePriceSave(); if (e.key === "Escape") setEditingPrice(null); }}
                        className="w-28 h-7 px-2 text-right rounded-lg border border-[#B8837E] text-sm font-medium text-[#5C3E35] bg-white focus:outline-none"
                      />
                    ) : (
                      <span onClick={() => setEditingPrice({ id: product.id, field: "price_30", value: product.price_30 || 0 })}
                        className="font-medium text-[#B8837E] cursor-pointer hover:bg-[#FAF6F0] px-2 py-0.5 rounded transition-colors">
                        {formatCurrency(product.price_30 || 0)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">35% exacto</span>
                    <span className="font-medium text-[#9C8A82]">{formatCurrency(product.cost * (product.apply_itbis !== false ? (1 + ITBIS_RATE) : 1) * 1.35)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">35% redondeado</span>
                    {editingPrice?.id === product.id && editingPrice?.field === "price_35" ? (
                      <input type="number" step="0.01" value={editingPrice.value} autoFocus
                        onChange={(e) => setEditingPrice({ ...editingPrice, value: Number(e.target.value) })}
                        onBlur={handlePriceSave}
                        onKeyDown={(e) => { if (e.key === "Enter") handlePriceSave(); if (e.key === "Escape") setEditingPrice(null); }}
                        className="w-28 h-7 px-2 text-right rounded-lg border border-[#B8837E] text-sm font-medium text-[#5C3E35] bg-white focus:outline-none"
                      />
                    ) : (
                      <span onClick={() => setEditingPrice({ id: product.id, field: "price_35", value: product.price_35 || 0 })}
                        className="font-medium text-[#B8837E] cursor-pointer hover:bg-[#FAF6F0] px-2 py-0.5 rounded transition-colors">
                        {formatCurrency(product.price_35 || 0)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D8] mt-2">
                    <span className="text-xs font-medium text-[#5C3E35]">ITBIS</span>
                    <button onClick={() => handleToggleItbis(product)} disabled={savingItbis === product.id}
                      className={`relative w-12 h-6 rounded-full transition-colors ${product.apply_itbis !== false ? "bg-[#B8837E]" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${product.apply_itbis !== false ? "translate-x-6" : "translate-x-0"}`} />
                    </button>
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
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A12345" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => {
                const newName = e.target.value;
                const isNutri = subbrands.find((s: any) => s.id === form.subbrand_id)?.name === "Nutrilite";
                const isProteina = newName.toLowerCase().includes("proteína vegetal");
                setForm({ ...form, name: newName, apply_itbis: isNutri ? isProteina : true });
              }} placeholder="Nombre del producto" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Submarca</label>
              <select value={form.subbrand_id} onChange={(e) => {
                if (e.target.value === "__new__") { setNewForFilter(null); setShowNewSubbrand(true); return; }
                const sub = subbrands.find((s: any) => s.id === e.target.value);
                const name = form.name.toLowerCase();
                const isNutri = sub?.name === "Nutrilite";
                const isProteina = name.includes("proteína vegetal");
                setForm({ ...form, subbrand_id: e.target.value, apply_itbis: !(isNutri && !isProteina) });
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
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Costo Amway (RD$)</label>
              <input type="number" step="0.01" value={form.cost} onChange={(e) => {
                const c = Number(e.target.value);
                const total = c * (form.apply_itbis !== false ? (1 + ITBIS_RATE) : 1);
                setForm({ ...form, cost: c, price_30: roundToNearest50(total * 1.3), price_35: roundToNearest50(total * 1.35) });
              }} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">PV</label>
              <input type="number" step="0.01" value={form.pv} onChange={(e) => setForm({ ...form, pv: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio 30%</label>
              <input type="number" step="0.01" value={form.price_30} onChange={(e) => setForm({ ...form, price_30: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
              <p className="text-[10px] text-[#9C8A82] mt-1">Exacto: {formatCurrency(Number(form.cost) * (form.apply_itbis !== false ? (1 + ITBIS_RATE) : 1) * 1.3)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio 35%</label>
              <input type="number" step="0.01" value={form.price_35} onChange={(e) => setForm({ ...form, price_35: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
              <p className="text-[10px] text-[#9C8A82] mt-1">Exacto: {formatCurrency(Number(form.cost) * (form.apply_itbis !== false ? (1 + ITBIS_RATE) : 1) * 1.35)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#5C3E35]">Aplicar ITBIS en cálculos</label>
            <button type="button" onClick={() => {
              const newVal = !(form.apply_itbis !== false);
              setForm({ ...form, apply_itbis: newVal });
            }}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.apply_itbis !== false ? "bg-[#B8837E]" : "bg-gray-300"}`}
              style={{ height: "20px" }}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.apply_itbis !== false ? "translate-x-[21px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="border-t border-[#E8E0D8] pt-4 mt-2">
            <label className="block text-sm font-medium text-[#5C3E35] mb-2">Duración del producto</label>
            <p className="text-xs text-[#9C8A82] mb-3">Define cuántos días dura este producto para programar automáticamente la próxima compra en CRM.</p>
            <div className="flex gap-2 flex-wrap">
              {[null, 10, 15, 20, 30, 60].map((d) => (
                <button
                  key={d ?? 0}
                  type="button"
                  onClick={() => setForm({ ...form, duracion_dias: d })}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
                    form.duracion_dias === d
                      ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]"
                      : "border-[#E8E0D8] text-[#9C8A82] hover:border-[#B8837E]/30 hover:text-[#5C3E35]"
                  }`}
                >
                  {d ? `${d} días` : "Sin duración"}
                </button>
              ))}
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

      <Modal isOpen={showManageSubbrands} onClose={() => { setShowManageSubbrands(false); setDeletingSubbrand(null); }} title="Gestionar Submarcas">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {subbrands.length === 0 ? (
            <p className="text-sm text-[#9C8A82] py-4 text-center">No hay submarcas</p>
          ) : subbrands.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0]">
              <span className="text-sm text-[#5C3E35]">{s.name}</span>
              <button
                onClick={async () => {
                  if (deletingSubbrand === s.id || !confirm(`¿Eliminar "${s.name}"?`)) return;
                  setDeletingSubbrand(s.id);
                  try {
                    await deactivateSubbrand(s.id);
                    setSubbrands((prev) => prev.filter((x) => x.id !== s.id));
                    if (filterSubbrand === s.id) setFilterSubbrand("");
                    toast.success(`"${s.name}" eliminada`);
                  } catch { toast.error("Error al eliminar"); }
                  finally { setDeletingSubbrand(null); }
                }}
                disabled={deletingSubbrand === s.id}
                className="p-1.5 text-[#9C8A82] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Eliminar submarca"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={showManageCategories} onClose={() => { setShowManageCategories(false); setDeletingCategory(null); }} title="Gestionar Categorías">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-sm text-[#9C8A82] py-4 text-center">No hay categorías</p>
          ) : categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0]">
              <span className="text-sm text-[#5C3E35]">{c.name}</span>
              <button
                onClick={async () => {
                  if (deletingCategory === c.id || !confirm(`¿Eliminar "${c.name}"?`)) return;
                  setDeletingCategory(c.id);
                  try {
                    await deactivateCategory(c.id);
                    setCategories((prev) => prev.filter((x) => x.id !== c.id));
                    if (filterCategory === c.id) setFilterCategory("");
                    toast.success(`"${c.name}" eliminada`);
                  } catch { toast.error("Error al eliminar"); }
                  finally { setDeletingCategory(null); }
                }}
                disabled={deletingCategory === c.id}
                className="p-1.5 text-[#9C8A82] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Eliminar categoría"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} title={viewingProduct?.name || "Detalles del Producto"} wide>
        {viewingProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Código</label>
                <p className="text-sm text-[#5C3E35]">{viewingProduct.code || "N/A"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Submarca</label>
                <p className="text-sm text-[#5C3E35]">{viewingProduct.subbrands?.name || "N/A"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Categoría</label>
                <p className="text-sm text-[#5C3E35]">{viewingProduct.categories?.name || "N/A"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">PV</label>
                <p className="text-sm text-[#5C3E35]">{viewingProduct.pv || "N/A"}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Costo Amway</label>
                <p className="text-sm font-medium text-[#5C3E35]">{formatCurrency(viewingProduct.cost)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Costo + ITBIS</label>
                <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(viewingProduct.cost * (viewingProduct.apply_itbis !== false ? (1 + ITBIS_RATE) : 1))}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Precio 30%</label>
                <p className="text-sm font-medium text-[#B8837E]">{formatCurrency(viewingProduct.price_30 || 0)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Precio 35%</label>
                <p className="text-sm font-medium text-[#B8837E]">{formatCurrency(viewingProduct.price_35 || 0)}</p>
              </div>
            </div>
            {(viewingProduct.description || viewingProduct.benefits) && (
              <div className="border-t border-[#E8E0D8] pt-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-2">Descripción completa</label>
                <div className="p-4 bg-[#FAF6F0] rounded-xl max-h-[60vh] overflow-y-auto">
                  <p className="text-sm text-[#5C3E35] whitespace-pre-wrap leading-relaxed">{viewingProduct.description || viewingProduct.benefits}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewingProduct(null)} className="h-10 px-6 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
