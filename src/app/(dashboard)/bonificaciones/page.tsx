"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import { normalize } from "@/lib/search";
import { getBonuses, createBonus, updateBonus, deleteBonus } from "@/services/bonuses";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Award, Edit3, Trash2, Save, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { Bonus, BonusType } from "@/types/database";

const BONUS_TYPES: BonusType[] = ["BONIFICACIÓN", "INCENTIVO", "PREMIO", "REEMBOLSO"];

function badgeType(type: BonusType) {
  const colors: Record<BonusType, string> = {
    "BONIFICACIÓN": "bg-blue-50 text-blue-600",
    "INCENTIVO": "bg-green-50 text-green-600",
    "PREMIO": "bg-amber-50 text-amber-600",
    "REEMBOLSO": "bg-purple-50 text-purple-600",
  };
  return colors[type];
}

export default function BonificacionesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Bonus | null>(null);
  const [showDelete, setShowDelete] = useState<Bonus | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    bonus_date: getLocalDateString(),
    bonus_type: "BONIFICACIÓN" as BonusType,
    description: "",
    amount: 0,
  });

  async function loadData() {
    setLoading(true);
    try {
      const data = await getBonuses();
      setBonuses(data);
    } catch {
      toast.error("Error al cargar bonificaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const total = bonuses.reduce((s, b) => s + Number(b.amount), 0);
  const filtered = bonuses.filter((b) => {
    const q = normalize(searchQuery);
    return normalize(b.description || "").includes(q)
      || normalize(b.bonus_type).includes(q);
  });

  function resetForm() {
    setForm({
      bonus_date: getLocalDateString(),
      bonus_type: "BONIFICACIÓN",
      description: "",
      amount: 0,
    });
  }

  async function handleCreate() {
    if (form.amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    setSaving(true);
    try {
      await createBonus({
        bonus_date: form.bonus_date,
        bonus_type: form.bonus_type,
        description: form.description.trim() || undefined,
        amount: form.amount,
        created_by: user?.id,
      });
      toast.success("Bonificación registrada");
      setShowCreate(false);
      resetForm();
      await loadData();
    } catch {
      toast.error("Error al registrar bonificación");
    } finally { setSaving(false); }
  }

  function openEdit(b: Bonus) {
    setForm({
      bonus_date: b.bonus_date,
      bonus_type: b.bonus_type,
      description: b.description || "",
      amount: Number(b.amount),
    });
    setShowEdit(b);
  }

  async function handleEdit() {
    if (!showEdit) return;
    if (form.amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    setSaving(true);
    try {
      await updateBonus(showEdit.id, {
        bonus_date: form.bonus_date,
        bonus_type: form.bonus_type,
        description: form.description.trim() || undefined,
        amount: form.amount,
        updated_by: user?.id,
      });
      toast.success("Bonificación actualizada");
      setShowEdit(null);
      await loadData();
    } catch {
      toast.error("Error al actualizar bonificación");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!showDelete) return;
    setSaving(true);
    try {
      await deleteBonus(showDelete.id);
      toast.success("Bonificación eliminada");
      setShowDelete(null);
      await loadData();
    } catch {
      toast.error("Error al eliminar bonificación");
    } finally { setSaving(false); }
  }

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Fecha</label>
          <input type="date" value={form.bonus_date}
            onChange={(e) => setForm({ ...form, bonus_date: e.target.value })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Tipo</label>
          <select value={form.bonus_type}
            onChange={(e) => setForm({ ...form, bonus_type: e.target.value as BonusType })}
            className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 appearance-none">
            {BONUS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Monto RD$</label>
        <input type="number" step="0.01" min="0" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#5C3E35] mb-1.5">Descripción <span className="text-[#9C8A82] font-normal">(opcional)</span></label>
        <textarea value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2} placeholder="Describe la bonificación..."
          className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] placeholder-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none" />
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-2 transition-colors">
            <ArrowLeft size={16} /> Volver al Dashboard
          </button>
          <h1 className="text-xl font-bold text-[#5C3E35]">Bonificaciones</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Incentivos y premios para clientes</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 bg-[#D4A0A0] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#C08080] transition-all shadow-sm">
          <Plus size={18} /> Nueva Bonificación
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] mb-6">
        <p className="text-xs text-[#9C8A82] mb-1">Total Bonificaciones</p>
        <p className="text-2xl font-bold text-[#B8837E]">{formatCurrency(total)}</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por tipo o descripción..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#9C8A82] text-sm">Cargando bonificaciones...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <Award size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? "Sin resultados" : "No hay bonificaciones registradas"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md">
                  <td className="px-4 py-3.5 text-sm text-[#9C8A82] whitespace-nowrap">{formatDate(b.bonus_date)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${badgeType(b.bonus_type)}`}>{b.bonus_type}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#5C3E35]">
                    {b.description || <span className="text-[#C8C0B8]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#B8837E] text-right font-medium">{formatCurrency(Number(b.amount))}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(b)}
                        className="p-2 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg transition-all"><Edit3 size={15} /></button>
                      <button onClick={() => setShowDelete(b)}
                        className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva Bonificación">
        {formFields}
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowCreate(false)}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Editar Bonificación">
        {formFields}
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowEdit(null)}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={handleEdit} disabled={saving}
            className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Actualizar"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Eliminar Bonificación">
        <div className="space-y-4">
          <p className="text-sm text-[#5C3E35]">
            ¿Eliminar esta bonificación por <strong>{formatCurrency(Number(showDelete?.amount || 0))}</strong>?
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
    </PageContainer>
  );
}