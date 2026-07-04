"use client";

import { useState, useEffect, useRef } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatDate, numberToWords, getLocalDateString } from "@/lib/utils";
import { normalize } from "@/lib/search";
import { generateExpensePdf } from "@/lib/pdf";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/services/expenses";
import { getSettings } from "@/services/settings";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, TrendingDown, Edit3, Trash2, Save, Eye, FileText, Download, Flower2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Expense, Settings } from "@/types/database";

const DEFAULT_CATEGORIES = ["Alquiler", "Servicios", "Transporte", "Oficina", "Marketing", "Salarios", "Suministros", "Otros"];

const SUBCATEGORIES: Record<string, string[]> = {
  Alquiler: ["Local", "Oficina", "Almacén", "Parqueo"],
  Servicios: ["Electricidad", "Agua", "Internet", "Teléfono"],
  Transporte: ["Combustible", "Peaje", "Mantenimiento", "Estacionamiento"],
  Oficina: ["Papelería", "Útiles", "Mobiliario", "Equipos"],
  Marketing: ["Redes Sociales", "Impresos", "Eventos", "Publicidad"],
  Salarios: ["Sueldo", "Comisión", "Bono", "Seguridad Social"],
  Suministros: ["Agua Embotellada", "Café", "Limpieza", "Cafetería"],
  Otros: [],
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro"];
const RECURRING_PERIODS = ["Mensual", "Trimestral", "Semestral", "Anual"];
const BRANCHES = ["Principal", "Sucursal 1", "Sucursal 2", "Online"];
const AGREGAR_NUEVA = "__AGREGAR_NUEVA__";

interface CatSelectProps {
  value: string; onChange: (v: string) => void;
  allCategories: string[]; newInput: string; setNewInput: (v: string) => void;
}

function CategorySelect({ value, onChange, allCategories, newInput, setNewInput }: CatSelectProps) {
  return (
    <div>
      <select value={value}
        onChange={(e) => { onChange(e.target.value); }}
        className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
        {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={AGREGAR_NUEVA}>+ Agregar nueva...</option>
      </select>
      {value === AGREGAR_NUEVA && (
        <input type="text" value={newInput}
          onChange={(e) => setNewInput(e.target.value)}
          placeholder="Nombre de la nueva categoría..."
          className="w-full h-10 px-4 mt-2 rounded-xl border border-[#D4A0A0] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
      )}
    </div>
  );
}

interface SubcatSelectProps {
  value: string; onChange: (v: string) => void;
  category: string; newCatInput: string; customSubcats: string[];
  newInput: string; setNewInput: (v: string) => void;
}

function SubcategorySelect({ value, onChange, category, newCatInput, customSubcats, newInput, setNewInput }: SubcatSelectProps) {
  const cat = category === AGREGAR_NUEVA ? newCatInput || category : category;
  const allPredefined = Object.values(SUBCATEGORIES).flat();
  const options = category === AGREGAR_NUEVA || !DEFAULT_CATEGORIES.includes(cat)
    ? [...new Set([...allPredefined, ...customSubcats])]
    : [...(SUBCATEGORIES[cat] || []), ...customSubcats];
  return (
    <div>
      <select value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
        <option value="">Sin subcategoría</option>
        {options.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value={AGREGAR_NUEVA}>+ Agregar nueva...</option>
      </select>
      {value === AGREGAR_NUEVA && (
        <input type="text" value={newInput}
          onChange={(e) => setNewInput(e.target.value)}
          placeholder="Nombre de la nueva subcategoría..."
          className="w-full h-10 px-4 mt-2 rounded-xl border border-[#D4A0A0] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
      )}
    </div>
  );
}

function badgeColor(cat: string) {
  const colors: Record<string, string> = {
    Alquiler: "bg-blue-50 text-blue-600",
    Servicios: "bg-purple-50 text-purple-600",
    Transporte: "bg-amber-50 text-amber-600",
    Oficina: "bg-teal-50 text-teal-600",
    Marketing: "bg-rose-50 text-rose-600",
    Salarios: "bg-green-50 text-green-600",
    Suministros: "bg-orange-50 text-orange-600",
  };
  return colors[cat] || "bg-[#FAF6F0] text-[#9C8A82]";
}

export default function GastosPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Expense | null>(null);
  const [showDelete, setShowDelete] = useState<Expense | null>(null);
  const [showDetail, setShowDetail] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newSubcategoryInput, setNewSubcategoryInput] = useState("");

  const [form, setForm] = useState({
    expense_date: getLocalDateString(),
    category: DEFAULT_CATEGORIES[0],
    concept: "",
    amount: 0,
    payment_method: "Efectivo",
    beneficiary: "",
    receipt_number: "",
    subcategory: "",
    is_deductible: false,
    branch: "",
    is_recurring: false,
    recurring_period: "",
    comments: "",
  });

  // JPG
  const [jpgData, setJpgData] = useState<Expense | null>(null);
  const jpgRef = useRef<HTMLDivElement>(null);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.filter((c) => !DEFAULT_CATEGORIES.includes(c))];
  const subcatOptions = [...(SUBCATEGORIES[form.category] || []), ...customSubcategories];

  async function loadData() {
    setLoading(true);
    try {
      const [data, st] = await Promise.all([getExpenses(), getSettings().catch(() => null)]);
      setExpenses(data);
      setSettings(st);
    } catch {
      toast.error("Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const total = expenses.reduce((s, g) => s + Number(g.amount), 0);
  const totalDeductible = expenses.reduce((s, g) => s + (g.is_deductible ? Number(g.amount) : 0), 0);

  const filtered = expenses.filter((g) => {
    const q = normalize(searchQuery);
    const matchesSearch = normalize(g.concept).includes(q)
      || normalize(g.category).includes(q)
      || normalize(g.beneficiary || "").includes(q)
      || normalize(g.receipt_number || "").includes(q);
    if (!matchesSearch) return false;
    if (filterMonth || filterYear) {
      const d = new Date(g.expense_date);
      if (filterMonth && String(d.getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
      if (filterYear && String(d.getFullYear()) !== filterYear) return false;
    }
    return true;
  });

  function resetForm() {
    setForm({
    expense_date: getLocalDateString(),
      category: DEFAULT_CATEGORIES[0],
      concept: "",
      amount: 0,
      payment_method: "Efectivo",
      beneficiary: "",
      receipt_number: "",
      subcategory: "",
      is_deductible: false,
      branch: "",
      is_recurring: false,
      recurring_period: "",
      comments: "",
    });
    setNewCategoryInput("");
    setNewSubcategoryInput("");
  }

  function buildExpensePayload() {
    let category = form.category;
    if (category === AGREGAR_NUEVA && newCategoryInput.trim()) {
      category = newCategoryInput.trim();
    }
    let subcategory = form.subcategory;
    if (subcategory === AGREGAR_NUEVA && newSubcategoryInput.trim()) {
      subcategory = newSubcategoryInput.trim();
    }
    return {
      expense_date: form.expense_date,
      category,
      concept: form.concept.trim(),
      amount: form.amount,
      payment_method: form.payment_method,
      beneficiary: form.beneficiary.trim() || undefined,
      receipt_number: form.receipt_number.trim() || undefined,
      subcategory: subcategory || undefined,
      is_deductible: form.is_deductible,
      branch: form.branch || undefined,
      is_recurring: form.is_recurring,
      recurring_period: form.is_recurring ? form.recurring_period : undefined,
      comments: form.comments.trim() || undefined,
    };
  }

  async function handleCreate() {
    if (!form.concept.trim()) { toast.error("Describe el gasto"); return; }
    if (form.amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (form.category === AGREGAR_NUEVA && !newCategoryInput.trim()) {
      toast.error("Escribe el nombre de la nueva categoría"); return;
    }
    if (form.subcategory === AGREGAR_NUEVA && !newSubcategoryInput.trim()) {
      toast.error("Escribe el nombre de la nueva subcategoría"); return;
    }
    setSaving(true);
    try {
      const payload = buildExpensePayload();
      await createExpense({ ...payload, created_by: user?.id });
      if (form.category === AGREGAR_NUEVA && newCategoryInput.trim()) {
        setCustomCategories((prev) => [...new Set([...prev, newCategoryInput.trim()])]);
      }
      if (form.subcategory === AGREGAR_NUEVA && newSubcategoryInput.trim()) {
        setCustomSubcategories((prev) => [...new Set([...prev, newSubcategoryInput.trim()])]);
      }
      toast.success("Gasto registrado");
      setShowCreate(false);
      resetForm();
      await loadData();
    } catch {
      toast.error("Error al registrar gasto");
    } finally { setSaving(false); }
  }

  function openEdit(g: Expense) {
    setForm({
      expense_date: g.expense_date,
      category: g.category,
      concept: g.concept,
      amount: Number(g.amount),
      payment_method: g.payment_method,
      beneficiary: g.beneficiary || "",
      receipt_number: g.receipt_number || "",
      subcategory: g.subcategory || "",
      is_deductible: g.is_deductible,
      branch: g.branch || "",
      is_recurring: g.is_recurring,
      recurring_period: g.recurring_period || "",
      comments: g.comments || "",
    });
    setShowEdit(g);
  }

  async function handleEdit() {
    if (!showEdit) return;
    if (!form.concept.trim()) { toast.error("Describe el gasto"); return; }
    if (form.amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (form.category === AGREGAR_NUEVA && !newCategoryInput.trim()) {
      toast.error("Escribe el nombre de la nueva categoría"); return;
    }
    if (form.subcategory === AGREGAR_NUEVA && !newSubcategoryInput.trim()) {
      toast.error("Escribe el nombre de la nueva subcategoría"); return;
    }
    setSaving(true);
    try {
      const payload = buildExpensePayload();
      await updateExpense(showEdit.id, { ...payload, updated_by: user?.id });
      if (form.category === AGREGAR_NUEVA && newCategoryInput.trim()) {
        setCustomCategories((prev) => [...new Set([...prev, newCategoryInput.trim()])]);
      }
      if (form.subcategory === AGREGAR_NUEVA && newSubcategoryInput.trim()) {
        setCustomSubcategories((prev) => [...new Set([...prev, newSubcategoryInput.trim()])]);
      }
      toast.success("Gasto actualizado");
      setShowEdit(null);
      await loadData();
    } catch {
      toast.error("Error al actualizar gasto");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!showDelete) return;
    setSaving(true);
    try {
      await deleteExpense(showDelete.id);
      toast.success("Gasto eliminado");
      setShowDelete(null);
      await loadData();
    } catch {
      toast.error("Error al eliminar gasto");
    } finally { setSaving(false); }
  }

  async function handlePrintPdf(g: Expense) {
    await generateExpensePdf({
      expense_date: formatDate(g.expense_date),
      category: g.category,
      subcategory: g.subcategory || undefined,
      concept: g.concept,
      amount: Number(g.amount),
      payment_method: g.payment_method,
      beneficiary: g.beneficiary || undefined,
      receipt_number: g.receipt_number || undefined,
      is_deductible: g.is_deductible,
      branch: g.branch || undefined,
      is_recurring: g.is_recurring,
      recurring_period: g.recurring_period || undefined,
      comments: g.comments || undefined,
      logo_url: settings?.logo_url,
      business_name: settings?.business_name,
      email: settings?.email,
      phone: settings?.phone,
    });
  }

  async function handlePrintJpg(g: Expense) {
    try {
      setJpgData(g);
      await new Promise((r) => setTimeout(r, 100));
      const html2canvas = (await import("html2canvas")).default;
      let el = jpgRef.current;
      let retries = 0;
      while (!el && retries < 10) {
        await new Promise((r) => setTimeout(r, 200));
        el = jpgRef.current;
        retries++;
      }
      if (!el) { toast.error("Vista previa no disponible"); setJpgData(null); return; }
      el.style.display = "block";
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      el.style.display = "none";
      const link = document.createElement("a");
      link.download = `gasto-${g.expense_date}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      setJpgData(null);
      toast.success("JPG descargado");
    } catch {
      toast.error("Error al generar JPG");
      setJpgData(null);
    }
  }

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Fecha</label>
          <input type="date" value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Categoría</label>
          <CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v, subcategory: "" })}
            allCategories={allCategories} newInput={newCategoryInput} setNewInput={setNewCategoryInput} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Subcategoría <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
          <SubcategorySelect value={form.subcategory} onChange={(v) => setForm({ ...form, subcategory: v })}
            category={form.category} newCatInput={newCategoryInput}
            customSubcats={customSubcategories} newInput={newSubcategoryInput} setNewInput={setNewSubcategoryInput} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Método de Pago</label>
          <select value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Concepto</label>
        <input type="text" value={form.concept}
          onChange={(e) => setForm({ ...form, concept: e.target.value })}
          placeholder="Describe el gasto..."
          className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Monto RD$</label>
          <input type="number" step="0.01" min="0" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Beneficiario <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
          <input type="text" value={form.beneficiary}
            onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
            placeholder="A quién se pagó..."
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">N° Comprobante <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
          <input type="text" value={form.receipt_number}
            onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
            placeholder="Factura o recibo..."
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Sucursal <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
          <select value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
            <option value="">Sin asignar</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_deductible}
              onChange={(e) => setForm({ ...form, is_deductible: e.target.checked })}
              className="w-5 h-5 rounded border-[#E8E0D8] text-[#B8837E] focus:ring-[#B8837E]/30" />
            <span className="text-sm text-[#5C3E35]">Deducible</span>
          </label>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_recurring}
              onChange={(e) => setForm({ ...form, is_recurring: e.target.checked, recurring_period: e.target.checked ? form.recurring_period || "Mensual" : "" })}
              className="w-5 h-5 rounded border-[#E8E0D8] text-[#B8837E] focus:ring-[#B8837E]/30" />
            <span className="text-sm text-[#5C3E35]">Recurrente</span>
          </label>
        </div>
      </div>
      {form.is_recurring && (
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Periodicidad</label>
          <select value={form.recurring_period}
            onChange={(e) => setForm({ ...form, recurring_period: e.target.value })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
            {RECURRING_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Notas <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
        <textarea value={form.comments}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
          rows={2} placeholder="Notas adicionales..."
          className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none" />
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Gastos</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Registro de gastos operativos</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 bg-[#D4A0A0] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#C08080] transition-all shadow-sm">
          <Plus size={18} /> Registrar Gasto
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Total Gastos</p>
          <p className="text-2xl font-bold text-[#D4A0A0]">{formatCurrency(total)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Gastos Deducibles</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDeductible)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">No Deducibles</p>
          <p className="text-2xl font-bold text-[#9C8A82]">{formatCurrency(total - totalDeductible)}</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por concepto, beneficiario, categoría o comprobante..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
      </div>

      <div className="flex gap-3 mb-6">
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
          <option value="">Todos los meses</option>
          {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
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
        <div className="text-center py-16 text-[#9C8A82] text-sm">Cargando gastos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <TrendingDown size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? "Sin resultados" : "No hay gastos registrados"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Concepto</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Beneficiario</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Pago</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Ded.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md">
                  <td className="px-4 py-3.5 text-sm text-[#9C8A82] whitespace-nowrap">{formatDate(g.expense_date)}</td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${badgeColor(g.category)}`}>{g.category}</span>
                    {g.subcategory && <span className="block text-[10px] text-[#9C8A82] mt-0.5">{g.subcategory}</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => setShowDetail(g)} className="text-left hover:text-[#B8837E] transition-colors">
                      <p className="text-sm text-[#5C3E35] font-medium">{g.concept}</p>
                    </button>
                    {g.comments && <p className="text-xs text-[#9C8A82] mt-0.5 truncate max-w-[200px]">{g.comments}</p>}
                  </td>
                  <td className="px-3 py-3.5 text-sm text-[#5C3E35]">
                    {g.beneficiary || <span className="text-[#C8C0B8]">—</span>}
                    {g.receipt_number && <span className="block text-[10px] text-[#9C8A82]">N° {g.receipt_number}</span>}
                  </td>
                  <td className="px-3 py-3.5 text-sm text-[#5C3E35]">
                    <span className="bg-[#FAF6F0] text-[#9C8A82] px-2 py-0.5 rounded text-xs">{g.payment_method}</span>
                    {g.branch && <span className="block text-[10px] text-[#9C8A82] mt-0.5">{g.branch}</span>}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {g.is_deductible
                      ? <span className="text-green-500 text-xs font-medium">Sí</span>
                      : <span className="text-[#C8C0B8] text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#D4A0A0] text-right font-medium whitespace-nowrap">
                    {formatCurrency(Number(g.amount))}
                    {g.is_recurring && <span className="block text-[10px] text-[#9C8A82]">Recurrente {g.recurring_period}</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => setShowDetail(g)}
                        className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-all" title="Ver detalle"><Eye size={15} /></button>
                      <button onClick={() => openEdit(g)}
                        className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-all" title="Editar"><Edit3 size={15} /></button>
                      <button onClick={() => setShowDelete(g)}
                        className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all" title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Registrar Gasto">
        {formFields}
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowCreate(false)}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 h-12 bg-[#D4A0A0] text-white rounded-xl text-sm font-medium hover:bg-[#C08080] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Editar Gasto">
        {formFields}
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowEdit(null)}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={handleEdit} disabled={saving}
            className="flex-1 h-12 bg-[#D4A0A0] text-white rounded-xl text-sm font-medium hover:bg-[#C08080] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Actualizar"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Eliminar Gasto">
        <div className="space-y-4">
          <p className="text-sm text-[#5C3E35]">
            ¿Eliminar <strong>{showDelete?.concept}</strong> por <strong>{formatCurrency(Number(showDelete?.amount || 0))}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowDelete(null)}
              className="px-5 h-11 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleDelete} disabled={saving}
              className="px-5 h-11 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50">
              {saving ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Detalle del Gasto">
        {showDetail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Fecha</p>
                <p className="text-sm text-[#5C3E35] font-medium">{formatDate(showDetail.expense_date)}</p>
              </div>
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Categoría</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${badgeColor(showDetail.category)}`}>{showDetail.category}</span>
              </div>
            </div>
            {showDetail.subcategory && (
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Subcategoría</p>
                <p className="text-sm text-[#5C3E35]">{showDetail.subcategory}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#9C8A82] mb-1">Concepto</p>
              <p className="text-sm text-[#5C3E35] font-medium">{showDetail.concept}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Monto</p>
                <p className="text-lg font-bold text-[#D4A0A0]">{formatCurrency(Number(showDetail.amount))}</p>
                <p className="text-xs text-[#9C8A82] mt-0.5 italic">{numberToWords(Number(showDetail.amount))}</p>
              </div>
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Método de Pago</p>
                <p className="text-sm text-[#5C3E35]">{showDetail.payment_method}</p>
              </div>
            </div>
            {(showDetail.beneficiary || showDetail.receipt_number) && (
              <div className="grid grid-cols-2 gap-4">
                {showDetail.beneficiary && (
                  <div>
                    <p className="text-xs text-[#9C8A82] mb-1">Beneficiario</p>
                    <p className="text-sm text-[#5C3E35]">{showDetail.beneficiary}</p>
                  </div>
                )}
                {showDetail.receipt_number && (
                  <div>
                    <p className="text-xs text-[#9C8A82] mb-1">N° Comprobante</p>
                    <p className="text-sm text-[#5C3E35]">{showDetail.receipt_number}</p>
                  </div>
                )}
              </div>
            )}
            {showDetail.branch && (
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Sucursal</p>
                <p className="text-sm text-[#5C3E35]">{showDetail.branch}</p>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Deducible</p>
                <span className={`text-sm font-medium ${showDetail.is_deductible ? "text-green-600" : "text-[#9C8A82]"}`}>
                  {showDetail.is_deductible ? "Sí" : "No"}
                </span>
              </div>
              {showDetail.is_recurring && (
                <div>
                  <p className="text-xs text-[#9C8A82] mb-1">Recurrente</p>
                  <p className="text-sm text-[#5C3E35]">{showDetail.recurring_period}</p>
                </div>
              )}
            </div>
            {showDetail.comments && (
              <div>
                <p className="text-xs text-[#9C8A82] mb-1">Notas</p>
                <p className="text-sm text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3">{showDetail.comments}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { handlePrintPdf(showDetail); }}
                className="flex-1 h-12 border border-[#D4A0A0] text-[#D4A0A0] rounded-xl text-sm font-medium hover:bg-[#D4A0A0]/5 transition-all flex items-center justify-center gap-2">
                <FileText size={18} /> Descargar PDF
              </button>
              <button onClick={() => handlePrintJpg(showDetail)}
                className="flex-1 h-12 border border-[#D4A0A0] text-[#D4A0A0] rounded-xl text-sm font-medium hover:bg-[#D4A0A0]/5 transition-all flex items-center justify-center gap-2">
                <Download size={18} /> Descargar JPG
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div ref={jpgRef} style={{ display: "none", position: "fixed", top: 0, left: 0, zIndex: 9999, background: "#ffffff", width: "600px" }}>
        {jpgData && (
          <div id="expense-preview" className="bg-white p-8" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="flex items-center justify-center gap-2 border-b border-[#E8E0D8] pb-4 mb-6">
              <Flower2 size={22} className="text-[#B8837E]" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#5C3E35", margin: 0 }}>{settings?.business_name || "Almaia RD"}</h1>
                <p style={{ fontSize: "12px", color: "#9C8A82", margin: "2px 0 0" }}>Comprobante de Gasto</p>
              </div>
            </div>
            <table style={{ width: "100%", fontSize: "11px", color: "#5C3E35", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Fecha", formatDate(jpgData.expense_date)],
                  ["Categoría", jpgData.category],
                  ...(jpgData.subcategory ? [["Subcategoría", jpgData.subcategory]] : []),
                  ["Concepto", jpgData.concept],
                  ["Método de Pago", jpgData.payment_method],
                  ...(jpgData.beneficiary ? [["Beneficiario", jpgData.beneficiary]] : []),
                  ...(jpgData.receipt_number ? [["N° Comprobante", jpgData.receipt_number]] : []),
                  ...(jpgData.branch ? [["Sucursal", jpgData.branch]] : []),
                  ["Deducible", jpgData.is_deductible ? "Sí" : "No"],
                  ...(jpgData.is_recurring && jpgData.recurring_period ? [["Recurrente", jpgData.recurring_period]] : []),
                  ...(jpgData.comments ? [["Notas", jpgData.comments]] : []),
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: "5px 12px", color: "#9C8A82", whiteSpace: "nowrap", verticalAlign: "top", width: "140px" }}>{label}</td>
                    <td style={{ padding: "5px 12px", fontWeight: 500 }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: "20px", padding: "16px", background: "#FCFAF7", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "20px", fontWeight: "bold", color: "#D4A0A0", margin: 0 }}>{formatCurrency(Number(jpgData.amount))}</p>
              <p style={{ fontSize: "10px", color: "#9C8A82", margin: "4px 0 0" }}>{numberToWords(Number(jpgData.amount))}</p>
            </div>
            <div style={{ marginTop: "24px", textAlign: "center", fontSize: "9px", color: "#9C8A82" }}>
              <p style={{ margin: 0 }}>{settings?.business_name || "Almaia RD"} — Distribuidora Autorizada Amway</p>
              {(settings?.phone || settings?.email) && (
                <p style={{ margin: "2px 0 0" }}>Tel: {settings?.phone || "N/D"} | Email: {settings?.email || "N/D"}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}