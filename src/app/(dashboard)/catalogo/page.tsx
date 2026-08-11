"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import { getProducts, createProduct, updateProduct, searchProducts, getCategories, getSubbrands, createCategory, createSubbrand, deactivateSubbrand, deactivateCategory, deleteProduct, getBundleItems, getBundleItemsBatch, createBundle, updateBundle, removeProductImage } from "@/services/products";
import { getSettings } from "@/services/settings";
import type { Product, Category, Subbrand, Settings, BundleItem } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { ITBIS_RATE } from "@/lib/constants";
import { invoiceLineTotalForUnit } from "@/lib/invoiceMath";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { BookOpen, Plus, Search, Upload, Edit2, Filter, Save, X, Brain, Trash2, Settings as SettingsIcon, Archive, RotateCcw, Eye, EyeOff, NotebookPen, Boxes, PackagePlus, Minus, Download, Copy, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const MARKUP_30 = 1.3;
const MARKUP_35 = 1.35;

// Excepciones Nutrilite que SÍ pagan ITBIS (confirmadas por la usuaria)
const NUTRILITE_ITBIS_EXCEPTIONS = ["proteína vegetal", "cerocarb", "fibra en polvo"];

function isNutriliteItbisException(name: string) {
  const n = name.toLowerCase();
  return NUTRILITE_ITBIS_EXCEPTIONS.some((e) => n.includes(e));
}

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
  const [filterBundles, setFilterBundles] = useState(false);

  const [form, setForm] = useState({
    code: "", name: "", description: "", benefits: "",
    cost: 0, pv: 0, price_30: 0, price_35: 0, apply_itbis: true, category_id: "", subbrand_id: "",
    duracion_dias: null as number | null,
    image_url: null as string | null,
  });

  const [showNewSubbrand, setShowNewSubbrand] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newSubbrandName, setNewSubbrandName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newForFilter, setNewForFilter] = useState<"subbrand" | "category" | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ id: string; field: "price_30" | "price_35"; value: number } | null>(null);
  const [savingItbis, setSavingItbis] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<any>(null);
  const [descForm, setDescForm] = useState({ description: "", benefits: "" });
  const [savingDesc, setSavingDesc] = useState(false);
  const [showManageSubbrands, setShowManageSubbrands] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [deletingSubbrand, setDeletingSubbrand] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [bundleForm, setBundleForm] = useState({ code: "", name: "", price: 0, image_url: null as string | null });
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleFilterBrand, setBundleFilterBrand] = useState("");
  const [bundleComponents, setBundleComponents] = useState<Array<{ product: any; quantity: number }>>([]);
  const [savingBundle, setSavingBundle] = useState(false);

  useEffect(() => {
    (async () => {
      const [cats, brands, st] = await Promise.all([getCategories(), getSubbrands(), getSettings().catch(() => null)]);
      setCategories(cats);
      setSubbrands(brands);
      if (st) setSettings(st);
    })();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await searchProducts(searchQuery);
      } else {
        data = await getProducts(true);
      }
      if (filterSubbrand) data = data.filter((p: any) => p.subbrand_id === filterSubbrand);
      if (filterCategory) data = data.filter((p: any) => p.category_id === filterCategory);
      data = await attachBundleItems(data as any[]);
      setProducts(showArchived ? data.filter((p: any) => !p.active) : data.filter((p: any) => p.active));
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }

  async function attachBundleItems(list: any[]): Promise<any[]> {
    const bundles = list.filter((p: any) => p.is_bundle && !p.bundle_items);
    if (bundles.length === 0) return list;
    try {
      const items = await getBundleItemsBatch(bundles.map((b: any) => b.id));
      const grouped = new Map<string, any[]>();
      for (const it of items) {
        const arr = grouped.get(it.bundle_id) || [];
        arr.push(it);
        grouped.set(it.bundle_id, arr);
      }
      return list.map((p: any) => {
        if (p.is_bundle && grouped.has(p.id)) p.bundle_items = grouped.get(p.id);
        return p;
      });
    } catch {
      return list;
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let data;
        if (searchQuery) {
          data = await searchProducts(searchQuery);
        } else {
          data = await getProducts(true);
        }
        if (filterSubbrand) data = data.filter((p: any) => p.subbrand_id === filterSubbrand);
        if (filterCategory) data = data.filter((p: any) => p.category_id === filterCategory);
        if (filterBundles) data = data.filter((p: any) => p.is_bundle);
        data = await attachBundleItems(data as any[]);
        setProducts(showArchived ? data.filter((p: any) => !p.active) : data.filter((p: any) => p.active));
      } catch {
        toast.error("Error al cargar productos");
      } finally {
        setLoading(false);
      }
    })();
  }, [searchQuery, filterSubbrand, filterCategory, showArchived, filterBundles]);

  function resetForm() {
    setForm({ code: "", name: "", description: "", benefits: "", cost: 0, pv: 0, price_30: 0, price_35: 0, apply_itbis: true, category_id: "", subbrand_id: "", duracion_dias: null, image_url: null });
    setEditingProduct(null);
  }

  function openNew() { resetForm(); setShowModal(true); }

  function openEdit(product: any) {
    if (product.is_bundle) { openBundleEditor(product); return; }
    setEditingProduct(product);
    setForm({
      code: product.code, name: product.name, description: product.description || "",
      benefits: product.benefits || "", cost: product.cost, pv: product.pv,
      price_30: product.price_30 || 0, price_35: product.price_35 || 0,
      apply_itbis: product.apply_itbis !== false,
      category_id: product.category_id || "", subbrand_id: product.subbrand_id || "",
      duracion_dias: product.duracion_dias || null,
      image_url: product.image_url || null,
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
      const auto30 = Math.round(cost * MARKUP_30 * 100) / 100;
      const auto35 = Math.round(cost * MARKUP_35 * 100) / 100;
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
        image_url: form.image_url || null,
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
      loadProducts();
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

  function openDescriptionEditor(product: any) {
    setEditingDescription(product);
    setDescForm({ description: product.description || "", benefits: product.benefits || "" });
  }

  async function handleSaveDescription() {
    if (!editingDescription) return;
    setSavingDesc(true);
    try {
      await updateProduct(editingDescription.id, {
        description: descForm.description || null,
        benefits: descForm.benefits || null,
      } as any);
      setProducts((prev: any[]) => prev.map((p) => (p.id === editingDescription.id ? { ...p, description: descForm.description, benefits: descForm.benefits } : p)));
      setEditingDescription(null);
      toast.success("Descripción actualizada");
    } catch { toast.error("Error al actualizar descripción"); }
    finally { setSavingDesc(false); }
  }

  async function handleToggleItbis(product: any) {    const newVal = !(product.apply_itbis !== false);
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

  async function handleDeleteProduct(product: any) {
    setDeletingProduct(true);
    try {
      await deleteProduct(product.id);
      await removeProductImage(product.image_url);
      setProducts((prev: any[]) => prev.filter((p) => p.id !== product.id));
      toast.success("Producto eliminado");
    } catch { toast.error("Error al eliminar producto"); }
    finally { setDeletingProduct(false); setConfirmDeleteProduct(null); }
  }

  function requestDeleteProduct(product: any) {
    setConfirmDeleteProduct(product);
  }

  function openBundleNew() {
    setEditingBundle(null);
    setBundleForm({ code: "", name: "", price: 0, image_url: null });
    setBundleComponents([]);
    setBundleSearch("");
    setBundleFilterBrand("");
    setShowBundleModal(true);
  }

  async function openBundleEditor(product: any) {
    setEditingBundle(product);
    let items: BundleItem[] = product.bundle_items;
    if (!items) {
      try { items = await getBundleItems(product.id); } catch { items = []; }
    }
    setBundleComponents(
      (items || []).map((it) => ({ product: it.products, quantity: it.quantity }))
    );
    setBundleForm({
      code: product.code || "",
      name: product.name || "",
      price: Number(product.price_30 || product.price_35 || 0),
      image_url: product.image_url || null,
    });
    setBundleSearch("");
    setBundleFilterBrand("");
    setShowBundleModal(true);
  }

  async function duplicateBundle(product: any) {
    let items: BundleItem[] = product.bundle_items;
    if (!items) {
      try { items = await getBundleItems(product.id); } catch { items = []; }
    }
    setEditingBundle(null);
    setBundleComponents(
      (items || []).map((it) => ({ product: it.products, quantity: it.quantity }))
    );
    setBundleForm({
      code: `${product.code || "BUN"}-COPIA`,
      name: `${product.name || "Bundle"} (Copia)`,
      price: Number(product.price_30 || product.price_35 || 0),
      image_url: null,
    });
    setBundleSearch("");
    setBundleFilterBrand("");
    setShowBundleModal(true);
  }

  function addBundleComponent(product: any) {
    setBundleComponents((prev) => {
      if (prev.some((c) => c.product.id === product.id)) {
        return prev.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeBundleComponent(productId: string) {
    setBundleComponents((prev) => prev.filter((c) => c.product.id !== productId));
  }

  function setBundleComponentQuantity(productId: string, quantity: number) {
    setBundleComponents((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity: Math.max(1, quantity || 1) } : c))
    );
  }

  function bundleSuggestedCost() {
    return bundleComponents.reduce((acc, c) => acc + (Number(c.product.cost) || 0) * c.quantity, 0);
  }

  function bundleSuggestedPv() {
    return bundleComponents.reduce((acc, c) => acc + (Number(c.product.pv) || 0) * c.quantity, 0);
  }

  function bundleSuggestedTotal(margin: number) {
    const cost = bundleSuggestedCost();
    return invoiceLineTotalForUnit(cost * margin, cost, true);
  }

  function bundleSummary() {
    if (bundleComponents.length === 0) return "";
    const parts = bundleComponents.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.product.name}`.trim());
    return `Combo especial: ${parts.join(" + ")}.`;
  }

  async function handleBundleSave() {
    if (!bundleForm.name.trim() || !bundleForm.code.trim()) {
      toast.error("Nombre y código del bundle son requeridos");
      return;
    }
    if (bundleComponents.length === 0) {
      toast.error("Agrega al menos un producto al bundle");
      return;
    }
    if (!bundleForm.price || bundleForm.price <= 0) {
      toast.error("Define el precio especial del combo");
      return;
    }
    setSavingBundle(true);
    try {
      const productData: Record<string, any> = {
        code: bundleForm.code.trim(),
        name: bundleForm.name.trim(),
        description: bundleSummary(),
        benefits: null,
        cost: Math.round(bundleSuggestedCost() * 100) / 100,
        pv: Math.round(bundleSuggestedPv() * 100) / 100,
        price_30: Number(bundleForm.price),
        price_35: Number(bundleForm.price),
        apply_itbis: true,
        category_id: null,
        subbrand_id: null,
        image_url: bundleForm.image_url || null,
        is_bundle: true,
      };
      const components = bundleComponents.map((c) => ({ product_id: c.product.id, quantity: c.quantity }));
      if (editingBundle) {
        await updateBundle(editingBundle.id, productData as any, components);
        toast.success("Bundle actualizado");
      } else {
        await createBundle(productData as any, components);
        toast.success("Bundle creado");
      }
      setShowBundleModal(false);
      loadProducts();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar bundle");
    } finally {
      setSavingBundle(false);
    }
  }

  const bundlePickerResults = products.filter((p: any) => {
    if (!p.active || p.is_bundle) return false;
    if (bundleFilterBrand && p.subbrand_id !== bundleFilterBrand) return false;
    const q = bundleSearch.trim().toLowerCase();
    if (q && !((p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))) return false;
    return true;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Catálogo de Productos</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Base de datos de productos Amway</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setFilterBundles(!filterBundles)}
            className={`h-12 px-4 rounded-xl border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${filterBundles ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]" : "border-[#E8E0D8] text-[#9C8A82] hover:bg-[#FAF6F0]"}`}
          >
            <Boxes size={18} /> {filterBundles ? "Ver todos" : "Solo bundles"}
          </button>
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
          <button onClick={openBundleNew} className="flex items-center gap-2 bg-white border border-[#B8837E]/50 text-[#B8837E] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#B8837E]/10 transition-all duration-200">
            <PackagePlus size={18} /> Crear Bundle
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm">
            <Plus size={18} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
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
            if (product.is_bundle) {
              const items = product.bundle_items || [];
              const hasItbisComponents = items.some((it: any) => it.products?.apply_itbis !== false);
              return (
                <div key={product.id} className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border-2 border-[#B8837E]/30 hover:shadow-md transition-shadow duration-200">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="relative w-24 h-24 rounded-xl bg-[#FAF6F0] flex items-center justify-center text-[#B8837E] flex-shrink-0 overflow-hidden border border-[#E8E0D8]">
                        {product.image_url ? (
                          <>
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                            <a
                              href={product.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Descargar imagen en alta resolución"
                              className="absolute bottom-1 right-1 w-7 h-7 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center text-[#B8837E] shadow-sm hover:bg-[#B8837E] hover:text-white transition-colors"
                            >
                              <Download size={14} />
                            </a>
                          </>
                        ) : (
                          <Boxes size={32} className="opacity-60" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="warning">BUNDLE</Badge>
                          {!product.active && <Badge variant="danger">Inactivo</Badge>}
                        </div>
                        <h3 className="font-medium text-[#5C3E35] text-lg mt-1">{product.name}</h3>
                        <p className="text-xs text-[#9C8A82]">{product.code}</p>
                        {product.image_url && (
                          <a href={product.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] hover:underline mt-1">
                            <Download size={12} /> Descargar imagen HD
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-medium text-[#9C8A82] uppercase tracking-wide">Precio especial</p>
                        <p className="text-2xl font-bold text-[#B8837E]">{formatCurrency(product.price_30 || 0)}</p>
                      </div>
                      <button onClick={() => openEdit(product)} className="p-2.5 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Editar bundle"><Edit2 size={16} /></button>
                      <button onClick={() => duplicateBundle(product)} className="p-2.5 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Duplicar bundle"><Copy size={16} /></button>
                      {!product.active ? (
                        <>
                          <button onClick={() => handleRestoreProduct(product)} className="p-2.5 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Restaurar"><RotateCcw size={16} /></button>
                          <button onClick={() => requestDeleteProduct(product)} className="p-2.5 text-[#D4A0A0] hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                        </>
                      ) : (
                        <button onClick={() => handleArchiveProduct(product)} className="p-2.5 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Archivar"><Archive size={16} /></button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
                    <div className="p-3 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                      <label className="block text-[10px] font-medium text-[#9C8A82] mb-0.5">Costo sugerido</label>
                      <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(product.cost)}</p>
                      <p className="text-[10px] text-[#9C8A82] mt-0.5">Suma de componentes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                      <label className="block text-[10px] font-medium text-[#9C8A82] mb-0.5">PV total</label>
                      <p className="text-sm font-bold text-[#5C3E35]">{product.pv || 0}</p>
                      <p className="text-[10px] text-[#9C8A82] mt-0.5">Suma de componentes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#B8837E]/10 border border-[#B8837E]/30">
                      <label className="block text-[10px] font-medium text-[#B8837E] mb-0.5">Sugerido 30% c/ITBIS</label>
                      <p className="text-sm font-bold text-[#B8837E]">{formatCurrency(invoiceLineTotalForUnit(product.cost * 1.3, product.cost || 0, hasItbisComponents))}</p>
                      <p className="text-[10px] text-[#9C8A82] mt-0.5">{formatCurrency(product.cost * 1.3)} base · {hasItbisComponents ? "c/ITBIS" : "sin ITBIS"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#B8837E]/10 border border-[#B8837E]/30">
                      <label className="block text-[10px] font-medium text-[#B8837E] mb-0.5">Sugerido 35% c/ITBIS</label>
                      <p className="text-sm font-bold text-[#B8837E]">{formatCurrency(invoiceLineTotalForUnit(product.cost * 1.35, product.cost || 0, hasItbisComponents))}</p>
                      <p className="text-[10px] text-[#9C8A82] mt-0.5">{formatCurrency(product.cost * 1.35)} base · {hasItbisComponents ? "c/ITBIS" : "sin ITBIS"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                      <label className="block text-[10px] font-medium text-[#9C8A82] mb-0.5">Ganancia estimada</label>
                      <p className="text-sm font-bold text-[#86C7A3]">{formatCurrency((product.price_30 || 0) - product.cost)}</p>
                      <p className="text-[10px] text-[#9C8A82] mt-0.5">Precio especial − costo</p>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-[#B8837E] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Boxes size={14} /> {items.length} {items.length === 1 ? "producto incluido" : "productos incluidos"}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {items.map((it: any) => {
                          const p = it.products;
                          if (!p) return null;
                          return (
                            <div key={it.id} className="bg-white rounded-2xl border border-[#E8E0D8] overflow-hidden flex flex-col">
                              <div className="flex items-center gap-3 p-3 bg-[#FAF6F0]/60 border-b border-[#E8E0D8]">
                                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[#9C8A82] flex-shrink-0 overflow-hidden">
                                  {p.image_url ? (
                                    <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <BookOpen size={20} className="opacity-40" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-[#5C3E35] leading-snug line-clamp-2">{p.name}</p>
                                  <p className="text-xs text-[#9C8A82]">Código: {p.code}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="px-2 py-1 rounded-lg bg-[#B8837E]/10 text-[#B8837E] text-xs font-bold">{it.quantity}×</span>
                                  {p.apply_itbis !== false && <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-medium">ITBIS</span>}
                                </div>
                              </div>
                              <div className="p-3 space-y-1.5 text-sm flex-1">
                                {p.subbrands && <div className="flex flex-wrap gap-1 mb-1"><Badge variant="info">{p.subbrands.name}</Badge></div>}
                                {p.categories && <div className="flex flex-wrap gap-1 mb-1"><Badge variant="neutral">{p.categories.name}</Badge></div>}
                                <div className="flex justify-between"><span className="text-[#9C8A82]">PV</span><span className="font-medium">{p.pv || 0}</span></div>
                                <div className="flex justify-between"><span className="text-[#9C8A82]">Costo Amway</span><span className="font-medium">{formatCurrency(p.cost)}</span></div>
                                {p.apply_itbis !== false && (
                                  <div className="flex justify-between"><span className="text-[#9C8A82]">Costo + ITBIS</span><span className="font-medium">{formatCurrency((p.cost || 0) * (1 + ITBIS_RATE))}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-[#9C8A82]">Precio 30%</span><span className="font-medium text-[#B8837E]">{formatCurrency(p.price_30 || 0)}</span></div>
                                {p.apply_itbis !== false && (
                                  <div className="flex justify-between"><span className="text-[#9C8A82]">Total c/ITBIS 30%</span><span className="font-bold text-[#5C3E35]">{formatCurrency(invoiceLineTotalForUnit(p.price_30 || 0, p.cost || 0, true))}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-[#9C8A82]">Precio 35%</span><span className="font-medium text-[#B8837E]">{formatCurrency(p.price_35 || 0)}</span></div>
                                {p.apply_itbis !== false && (
                                  <div className="flex justify-between"><span className="text-[#9C8A82]">Total c/ITBIS 35%</span><span className="font-bold text-[#5C3E35]">{formatCurrency(invoiceLineTotalForUnit(p.price_35 || 0, p.cost || 0, true))}</span></div>
                                )}
                                {(p.description || p.benefits) && (
                                  <div className="pt-2 mt-2 border-t border-[#E8E0D8]">
                                    <p className="text-xs text-[#5C3E35] whitespace-pre-wrap leading-relaxed line-clamp-4">{p.description || p.benefits}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <button type="button" onClick={() => setViewingProduct(product)} className="h-10 px-5 flex items-center justify-center gap-2 bg-[#FAF6F0] border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#B8837E]/10 hover:border-[#B8837E]/40 hover:text-[#B8837E] transition-all duration-200">
                      <Eye size={16} /> Ver bundle completo
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow duration-200 flex flex-col">
                {product.image_url ? (
                  <button type="button" onClick={() => setViewingProduct(product)} className="w-full h-36 rounded-xl overflow-hidden mb-3 bg-[#FAF6F0] cursor-pointer group">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  </button>
                ) : (
                  <button type="button" onClick={() => setViewingProduct(product)} className="w-full h-36 rounded-xl mb-3 bg-[#FAF6F0] flex items-center justify-center text-[#9C8A82] cursor-pointer">
                    <BookOpen size={32} className="opacity-40" />
                  </button>
                )}
                <div className="flex items-start justify-between mb-3">
                  <button type="button" onClick={() => setViewingProduct(product)} className="flex-1 text-left cursor-pointer">
                    <h3 className="font-medium text-[#5C3E35] hover:text-[#B8837E] transition-colors line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-[#9C8A82] mt-0.5">{product.code}</p>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(product)} className="p-2.5 sm:p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Editar"><Edit2 size={14} /></button>
                    {!product.active ? (
                      <>
                        <button onClick={() => handleRestoreProduct(product)} className="p-2.5 sm:p-2 text-[#86C7A3] hover:bg-green-50 rounded-lg transition-colors" title="Restaurar"><RotateCcw size={14} /></button>
                        <button onClick={() => requestDeleteProduct(product)} className="p-2.5 sm:p-2 text-[#D4A0A0] hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <button onClick={() => handleArchiveProduct(product)} className="p-2.5 sm:p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-colors" title="Archivar"><Archive size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {product.subbrands && <Badge variant="info">{product.subbrands.name}</Badge>}
                  {product.categories && <Badge variant="neutral">{product.categories.name}</Badge>}
                  {!product.active && <Badge variant="danger">Inactivo</Badge>}
                </div>
                <button
                  type="button"
                  onClick={() => openDescriptionEditor(product)}
                  className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] hover:underline transition-colors"
                  title="Editar descripción del producto"
                >
                  <NotebookPen size={13} />
                  {product.description ? "Editar descripción" : "Agregar descripción"}
                </button>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[#9C8A82]">Costo Amway</span><span className="font-medium">{formatCurrency(product.cost)}</span></div>
                  {product.apply_itbis !== false && (
                    <div className="flex justify-between"><span className="text-[#9C8A82]">Costo + ITBIS</span><span className="font-medium">{formatCurrency((product.cost || 0) * (1 + ITBIS_RATE))}</span></div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">Precio 30%</span>
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
                  {product.apply_itbis !== false && (
                    <div className="flex justify-between items-center"><span className="text-[#9C8A82]">Total c/ITBIS 30%</span><span className="font-bold text-[#5C3E35]">{formatCurrency(invoiceLineTotalForUnit(product.price_30 || 0, product.cost || 0, product.apply_itbis !== false))}</span></div>
                  )}
                  <div className="flex justify-between items-center"><span className="text-[#9C8A82]">Ganancia 30%</span><span className="font-medium text-[#86C7A3]">{formatCurrency((product.price_30 || 0) - product.cost)}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9C8A82]">Precio 35%</span>
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
                  {product.apply_itbis !== false && (
                    <div className="flex justify-between items-center"><span className="text-[#9C8A82]">Total c/ITBIS 35%</span><span className="font-bold text-[#5C3E35]">{formatCurrency(invoiceLineTotalForUnit(product.price_35 || 0, product.cost || 0, product.apply_itbis !== false))}</span></div>
                  )}
                  <div className="flex justify-between items-center"><span className="text-[#9C8A82]">Ganancia 35%</span><span className="font-medium text-[#86C7A3]">{formatCurrency((product.price_35 || 0) - product.cost)}</span></div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D8] mt-2">
                    <span className="text-xs font-medium text-[#5C3E35]">ITBIS</span>
                    <button onClick={() => handleToggleItbis(product)} disabled={savingItbis === product.id}
                      className={`relative w-12 h-6 rounded-full transition-colors ${product.apply_itbis !== false ? "bg-[#B8837E]" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${product.apply_itbis !== false ? "translate-x-6" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setViewingProduct(product)} className="mt-4 w-full h-10 flex items-center justify-center gap-2 bg-[#FAF6F0] border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#B8837E]/10 hover:border-[#B8837E]/40 hover:text-[#B8837E] transition-all duration-200">
                  <Eye size={16} /> Ver
                </button>
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
                setForm({ ...form, name: newName, apply_itbis: isNutri ? isNutriliteItbisException(newName) : true });
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
                setForm({ ...form, subbrand_id: e.target.value, apply_itbis: !(isNutri && !isNutriliteItbisException(form.name)) });
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Costo Amway (RD$)</label>
              <input type="number" step="0.01" value={form.cost} onChange={(e) => {
                const c = Number(e.target.value);
                setForm({ ...form, cost: c, price_30: Math.round(c * MARKUP_30 * 100) / 100, price_35: Math.round(c * MARKUP_35 * 100) / 100 });
              }} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">PV</label>
              <input type="number" step="0.01" value={form.pv} onChange={(e) => setForm({ ...form, pv: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio 30%</label>
              <input type="number" step="0.01" value={form.price_30} onChange={(e) => setForm({ ...form, price_30: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
              <p className="text-[10px] text-[#9C8A82] mt-1">Base: {formatCurrency(Number(form.cost) * MARKUP_30)}{form.apply_itbis !== false && <> · Total c/ITBIS: {formatCurrency(invoiceLineTotalForUnit(Number(form.price_30) || Number(form.cost) * MARKUP_30, Number(form.cost), true))}</>}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio 35%</label>
              <input type="number" step="0.01" value={form.price_35} onChange={(e) => setForm({ ...form, price_35: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
              <p className="text-[10px] text-[#9C8A82] mt-1">Base: {formatCurrency(Number(form.cost) * MARKUP_35)}{form.apply_itbis !== false && <> · Total c/ITBIS: {formatCurrency(invoiceLineTotalForUnit(Number(form.price_35) || Number(form.cost) * MARKUP_35, Number(form.cost), true))}</>}</p>
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
          <div className="border-t border-[#E8E0D8] pt-4">
            <ImageUpload
              currentUrl={form.image_url}
              onUploaded={(url) => setForm({ ...form, image_url: url })}
            />
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

      <Modal isOpen={showBundleModal} onClose={() => setShowBundleModal(false)} title={editingBundle ? "Editar Bundle" : "Crear Bundle"} wide>
        <div className="space-y-5">
          <div className="bg-[#B8837E]/10 border border-[#B8837E]/30 rounded-xl p-4 flex items-start gap-3">
            <Boxes size={20} className="text-[#B8837E] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#5C3E35]">
              Un bundle es un combo de productos a un precio especial. Busca productos del catálogo, agrégalos y fija el precio del combo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Código *</label>
              <input type="text" value={bundleForm.code} onChange={(e) => setBundleForm({ ...bundleForm, code: e.target.value })} placeholder="BUN-001" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre del bundle *</label>
              <input type="text" value={bundleForm.name} onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })} placeholder="Ej: Kit de Bienestar" className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Precio especial (RD$) *</label>
              <input type="number" step="0.01" min="0" value={bundleForm.price} onChange={(e) => setBundleForm({ ...bundleForm, price: Number(e.target.value) })} placeholder="0.00" className="w-full h-12 px-4 rounded-xl border border-[#B8837E] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all font-semibold" />
              <p className="text-[10px] text-[#9C8A82] mt-1">Se aplica a ambos márgenes (30% y 35%)</p>
              {bundleComponents.length > 0 && (
                <>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setBundleForm({ ...bundleForm, price: bundleSuggestedTotal(1.3) })}
                      className="flex-1 h-8 rounded-lg border border-[#B8837E]/50 text-[#B8837E] text-xs font-medium hover:bg-[#B8837E]/10 transition-all"
                      title="Fija el precio especial al sugerido de 30% con ITBIS"
                    >
                      Poner 30% ({formatCurrency(bundleSuggestedTotal(1.3))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBundleForm({ ...bundleForm, price: bundleSuggestedTotal(1.35) })}
                      className="flex-1 h-8 rounded-lg border border-[#B8837E]/50 text-[#B8837E] text-xs font-medium hover:bg-[#B8837E]/10 transition-all"
                      title="Fija el precio especial al sugerido de 35% con ITBIS"
                    >
                      Poner 35% ({formatCurrency(bundleSuggestedTotal(1.35))})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBundleForm({ ...bundleForm, price: bundleSuggestedTotal(1.35) }); toast.success("Sugeridos recalculados: precio fijado al 35% con ITBIS"); }}
                      className="h-8 px-2.5 rounded-lg border border-[#B8837E]/50 text-[#B8837E] text-xs font-medium hover:bg-[#B8837E]/10 transition-all flex items-center gap-1"
                      title="Recalcula los sugeridos desde los componentes y fija el precio al 35%"
                    >
                      <RefreshCw size={12} /> Recalcular sugeridos
                    </button>
                  </div>
                  <div className="mt-2 p-2.5 rounded-xl bg-[#B8837E]/10 border border-[#B8837E]/30 text-xs space-y-1">
                    <p className="text-[#9C8A82]">Sugerido <b className="text-[#B8837E]">30%</b> c/ITBIS: <b className="text-[#B8837E]">{formatCurrency(bundleSuggestedTotal(1.3))}</b></p>
                    <p className="text-[#9C8A82]">Sugerido <b className="text-[#B8837E]">35%</b> c/ITBIS: <b className="text-[#B8837E]">{formatCurrency(bundleSuggestedTotal(1.35))}</b></p>
                    <p className="text-[#9C8A82]">Costo total: <b className="text-[#5C3E35]">{formatCurrency(bundleSuggestedCost())}</b> · PV: <b className="text-[#5C3E35]">{bundleSuggestedPv()}</b></p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-[#E8E0D8] pt-4">
            <ImageUpload
              currentUrl={bundleForm.image_url}
              onUploaded={(url) => setBundleForm({ ...bundleForm, image_url: url })}
              maxSizeMB={5}
            />
          </div>

          <div className="border-t border-[#E8E0D8] pt-4">
            <label className="block text-sm font-medium text-[#5C3E35] mb-2">1. Buscar productos del catálogo</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                <input
                  type="text"
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  placeholder="Buscar por nombre o código..."
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                />
              </div>
              <select
                value={bundleFilterBrand}
                onChange={(e) => setBundleFilterBrand(e.target.value)}
                className="sm:w-56 h-12 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              >
                <option value="">Todas las marcas</option>
                {subbrands.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#E8E0D8] bg-white divide-y divide-[#E8E0D8]/60">
              {bundlePickerResults.length === 0 ? (
                <p className="text-sm text-[#9C8A82] p-4 text-center">
                  {bundleSearch.trim() || bundleFilterBrand ? "Sin resultados" : "No hay productos disponibles"}
                </p>
              ) : (
                bundlePickerResults.slice(0, 20).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-[#FAF6F0] transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF6F0] flex items-center justify-center text-[#9C8A82] flex-shrink-0 overflow-hidden">
                      {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-contain" /> : <BookOpen size={16} className="opacity-40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#5C3E35] truncate">{p.name}</p>
                      <p className="text-xs text-[#9C8A82]">{p.code} · {formatCurrency(p.price_30 || 0)} · PV {p.pv || 0}{p.subbrands?.name ? ` · ${p.subbrands.name}` : ""}</p>
                    </div>
                    <button
                      onClick={() => addBundleComponent(p)}
                      className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#B8837E] text-white text-xs font-medium hover:bg-[#9A6B66] transition-all flex-shrink-0"
                    >
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-[#E8E0D8] pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#5C3E35]">2. Productos del bundle ({bundleComponents.length})</label>
              {bundleComponents.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[#9C8A82]">Costo sugerido: <b className="text-[#5C3E35]">{formatCurrency(bundleSuggestedCost())}</b></span>
                  <span className="text-[#9C8A82]">PV: <b className="text-[#5C3E35]">{bundleSuggestedPv()}</b></span>
                  {bundleForm.price > 0 && (
                    <span className="text-[#86C7A3]">Ganancia: <b>{formatCurrency(bundleForm.price - bundleSuggestedCost())}</b></span>
                  )}
                </div>
              )}
            </div>
            {bundleComponents.length === 0 ? (
              <p className="text-sm text-[#9C8A82] py-6 text-center bg-[#FAF6F0] rounded-xl border border-dashed border-[#E8E0D8]">
                Aún no has agregado productos. Usa el buscador de arriba.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {bundleComponents.map((c) => {
                  const p = c.product;
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-[#E8E0D8] overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-12 h-12 rounded-lg bg-[#FAF6F0] flex items-center justify-center text-[#9C8A82] flex-shrink-0 overflow-hidden">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-contain" /> : <BookOpen size={20} className="opacity-40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#5C3E35] leading-snug line-clamp-2">{p.name}</p>
                          <p className="text-xs text-[#9C8A82]">{p.code} · {formatCurrency(p.price_30 || 0)} · PV {p.pv || 0}</p>
                        </div>
                        <button onClick={() => removeBundleComponent(p.id)} className="p-2 text-[#D4A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0" title="Quitar">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 bg-[#FCFAF7] border-t border-[#E8E0D8]">
                        <span className="text-xs text-[#9C8A82]">Cantidad</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBundleComponentQuantity(p.id, c.quantity - 1)}
                            disabled={c.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0] disabled:opacity-40 transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-[#5C3E35]">{c.quantity}</span>
                          <button
                            onClick={() => setBundleComponentQuantity(p.id, c.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0] transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[#E8E0D8] pt-4">
            <label className="block text-sm font-medium text-[#5C3E35] mb-3 flex items-center gap-1.5">
              <Eye size={15} className="text-[#9C8A82]" /> Vista previa del bundle
            </label>
            <div className="rounded-xl border border-[#B8837E]/30 bg-[#FAF6F0] p-4 flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-[#E8E0D8] flex-shrink-0">
                {bundleForm.image_url ? (
                  <img src={bundleForm.image_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Boxes size={28} className="text-[#9C8A82]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="warning">BUNDLE</Badge>
                  <span className="text-sm font-medium text-[#5C3E35] truncate">{bundleForm.name || "Nombre del bundle"}</span>
                </div>
                <p className="text-xs text-[#9C8A82] truncate mt-0.5">
                  {bundleForm.code || "Código"}
                  {bundleComponents.length > 0 && ` · ${bundleComponents.length} ${bundleComponents.length === 1 ? "producto" : "productos"} · ${bundleComponents.reduce((s, c) => s + c.quantity, 0)} unidades en total`}
                </p>
                <p className="text-lg font-bold text-[#B8837E]">{bundleForm.price > 0 ? formatCurrency(bundleForm.price) : "Precio especial por definir"}</p>
                {bundleComponents.length > 0 && (
                  <p className="text-xs text-[#9C8A82] truncate">{bundleSummary()}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowBundleModal(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleBundleSave} disabled={savingBundle} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <PackagePlus size={18} /> {savingBundle ? "Guardando..." : "Guardar Bundle"}
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
          <div className="space-y-5">
            {viewingProduct.image_url ? (
              <div>
                <div className="w-full max-h-[360px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#FAF6F0] to-[#F3EAE3] flex items-center justify-center p-6">
                  <img src={viewingProduct.image_url} alt={viewingProduct.name} className="max-h-[320px] w-auto object-contain" />
                </div>
                <a
                  href={viewingProduct.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#FAF6F0] border border-[#E8E0D8] text-[#5C3E35] text-sm font-medium hover:bg-[#B8837E]/10 hover:border-[#B8837E]/40 hover:text-[#B8837E] transition-all duration-200"
                >
                  <Download size={16} /> Descargar imagen en alta resolución
                </a>
              </div>
            ) : (
              <div className="w-full h-40 rounded-2xl bg-[#FAF6F0] flex items-center justify-center text-[#9C8A82]">
                <BookOpen size={40} className="opacity-40" />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {viewingProduct.is_bundle && <Badge variant="warning">BUNDLE</Badge>}
              {viewingProduct.subbrands && <Badge variant="info">{viewingProduct.subbrands.name}</Badge>}
              {viewingProduct.categories && <Badge variant="neutral">{viewingProduct.categories.name}</Badge>}
              {!viewingProduct.active && <Badge variant="danger">Inactivo</Badge>}
              {viewingProduct.apply_itbis !== false && <Badge variant="warning">Incluye ITBIS</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Código</label>
                <p className="text-sm font-semibold text-[#5C3E35]">{viewingProduct.code || "N/A"}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">PV</label>
                <p className="text-sm font-semibold text-[#5C3E35]">{viewingProduct.pv || "N/A"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                <label className="block text-[10px] font-medium text-[#9C8A82] mb-0.5">Costo Amway</label>
                <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(viewingProduct.cost)}</p>
                {viewingProduct.apply_itbis !== false && <p className="text-[10px] text-[#9C8A82] mt-0.5">+ ITBIS: {formatCurrency(viewingProduct.cost * (1 + ITBIS_RATE))}</p>}
              </div>
              <div className="p-3 rounded-xl bg-[#B8837E]/10 border border-[#B8837E]/30">
                <label className="block text-[10px] font-medium text-[#B8837E] mb-0.5">Precio 30%</label>
                <p className="text-sm font-bold text-[#B8837E]">{formatCurrency(viewingProduct.price_30 || 0)}</p>
                <p className="text-[10px] text-[#86C7A3] mt-0.5 font-medium">Ganancia: {formatCurrency((viewingProduct.price_30 || 0) - viewingProduct.cost)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#B8837E]/10 border border-[#B8837E]/30">
                <label className="block text-[10px] font-medium text-[#B8837E] mb-0.5">Precio 35%</label>
                <p className="text-sm font-bold text-[#B8837E]">{formatCurrency(viewingProduct.price_35 || 0)}</p>
                <p className="text-[10px] text-[#86C7A3] mt-0.5 font-medium">Ganancia: {formatCurrency((viewingProduct.price_35 || 0) - viewingProduct.cost)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FCFAF7] border border-[#E8E0D8]">
                <label className="block text-[10px] font-medium text-[#9C8A82] mb-0.5">Total c/ITBIS</label>
                {viewingProduct.apply_itbis !== false ? (
                  <>
                    <p className="text-sm font-bold text-[#5C3E35]">30%: {formatCurrency(invoiceLineTotalForUnit(viewingProduct.price_30 || 0, viewingProduct.cost || 0, viewingProduct.apply_itbis !== false))}</p>
                    <p className="text-sm text-[#5C3E35]">35%: {formatCurrency(invoiceLineTotalForUnit(viewingProduct.price_35 || 0, viewingProduct.cost || 0, viewingProduct.apply_itbis !== false))}</p>
                  </>
                ) : (
                  <p className="text-sm text-[#9C8A82]">Sin ITBIS</p>
                )}
              </div>
            </div>

            {(viewingProduct.description || viewingProduct.benefits) && (
              <div className="border-t border-[#E8E0D8] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-[#9C8A82]">Descripción completa</label>
                  <button
                    onClick={() => { openDescriptionEditor(viewingProduct); setViewingProduct(null); }}
                    className="flex items-center gap-1 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] hover:underline"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                </div>
                <div className="p-4 bg-[#FAF6F0] rounded-xl max-h-[40vh] overflow-y-auto">
                  <p className="text-sm text-[#5C3E35] whitespace-pre-wrap leading-relaxed">{viewingProduct.description || viewingProduct.benefits}</p>
                </div>
              </div>
            )}

            {viewingProduct.is_bundle && (
              <div className="border-t border-[#E8E0D8] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-medium text-[#9C8A82] flex items-center gap-1.5">
                    <Boxes size={14} /> Productos incluidos en el bundle
                  </label>
                  <button
                    onClick={() => { openBundleEditor(viewingProduct); setViewingProduct(null); }}
                    className="flex items-center gap-1 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] hover:underline"
                  >
                    <Edit2 size={12} /> Editar bundle
                  </button>
                </div>
                {(viewingProduct.bundle_items || []).length === 0 ? (
                  <p className="text-sm text-[#9C8A82] py-4 text-center bg-[#FAF6F0] rounded-xl">Este bundle no tiene productos registrados.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[45vh] overflow-y-auto pr-1">
                    {(viewingProduct.bundle_items || []).map((it: any) => {
                      const p = it.products;
                      if (!p) return null;
                      return (
                        <div key={it.id} className="bg-white rounded-xl border border-[#E8E0D8] overflow-hidden">
                          <div className="flex items-center gap-3 p-3 bg-[#FAF6F0]/60 border-b border-[#E8E0D8]">
                            <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[#9C8A82] flex-shrink-0 overflow-hidden">
                              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" /> : <BookOpen size={20} className="opacity-40" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#5C3E35] line-clamp-2">{p.name}</p>
                              <p className="text-xs text-[#9C8A82]">Código: {p.code}</p>
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-[#B8837E]/10 text-[#B8837E] text-xs font-bold flex-shrink-0">{it.quantity}×</span>
                          </div>
                          <div className="p-3 space-y-1.5 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {p.subbrands && <Badge variant="info">{p.subbrands.name}</Badge>}
                              {p.categories && <Badge variant="neutral">{p.categories.name}</Badge>}
                              {p.apply_itbis !== false && <Badge variant="warning">ITBIS</Badge>}
                            </div>
                            <div className="flex justify-between"><span className="text-[#9C8A82]">PV</span><span className="font-medium">{p.pv || 0}</span></div>
                            <div className="flex justify-between"><span className="text-[#9C8A82]">Costo Amway</span><span className="font-medium">{formatCurrency(p.cost)}</span></div>
                            {p.apply_itbis !== false && (
                              <div className="flex justify-between"><span className="text-[#9C8A82]">Costo + ITBIS</span><span className="font-medium">{formatCurrency((p.cost || 0) * (1 + ITBIS_RATE))}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-[#9C8A82]">Precio 30%</span><span className="font-medium text-[#B8837E]">{formatCurrency(p.price_30 || 0)}</span></div>
                            <div className="flex justify-between"><span className="text-[#9C8A82]">Precio 35%</span><span className="font-medium text-[#B8837E]">{formatCurrency(p.price_35 || 0)}</span></div>
                            {p.apply_itbis !== false && (
                              <div className="flex justify-between"><span className="text-[#9C8A82]">Total c/ITBIS 30%</span><span className="font-bold text-[#5C3E35]">{formatCurrency(invoiceLineTotalForUnit(p.price_30 || 0, p.cost || 0, true))}</span></div>
                            )}
                            {(p.description || p.benefits) && (
                              <div className="pt-2 mt-2 border-t border-[#E8E0D8]">
                                <p className="text-xs text-[#5C3E35] whitespace-pre-wrap leading-relaxed">{p.description || p.benefits}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => openEdit(viewingProduct)} className="h-10 px-5 flex items-center gap-2 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                <Edit2 size={15} /> Editar
              </button>
              {!viewingProduct.active ? (
                <button onClick={() => requestDeleteProduct(viewingProduct)} className="h-10 px-5 flex items-center gap-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm">
                  <Trash2 size={15} /> Eliminar
                </button>
              ) : (
                <button onClick={() => { handleArchiveProduct(viewingProduct); setViewingProduct(null); }} className="h-10 px-5 flex items-center gap-2 border border-[#E8E0D8] text-[#9C8A82] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                  <Archive size={15} /> Archivar
                </button>
              )}
              <button onClick={() => setViewingProduct(null)} className="h-10 px-6 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editingDescription} onClose={() => setEditingDescription(null)} title="Editar Descripción del Producto" wide>
        {editingDescription && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E8E0D8]">
              <p className="text-sm font-semibold text-[#5C3E35]">{editingDescription.name}</p>
              <p className="text-xs text-[#9C8A82] mt-0.5">Código: {editingDescription.code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descripción</label>
              <textarea value={descForm.description} onChange={(e) => setDescForm({ ...descForm, description: e.target.value })} rows={8} className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-y" placeholder="Descripción completa del producto..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Beneficios</label>
              <textarea value={descForm.benefits} onChange={(e) => setDescForm({ ...descForm, benefits: e.target.value })} rows={4} className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-y" placeholder="Beneficios del producto..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingDescription(null)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
              <button onClick={handleSaveDescription} disabled={savingDesc} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={18} /> {savingDesc ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmDeleteProduct} onClose={() => setConfirmDeleteProduct(null)} title="Confirmar Eliminación">
        <div className="space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">
              ¿Estás seguro de eliminar definitivamente <strong>&quot;{confirmDeleteProduct?.name}&quot;</strong>?
            </p>
            <p className="text-xs text-red-500 mt-2">Esta acción no se puede deshacer. El producto se borrará del catálogo junto con sus registros de inventario.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDeleteProduct(null)}
              className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleDeleteProduct(confirmDeleteProduct)}
              disabled={deletingProduct}
              className="flex-1 h-12 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> {deletingProduct ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
