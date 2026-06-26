"use client";

import { useState, useEffect, useCallback } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/services/suppliers";
import type { Supplier } from "@/types/database";
import { normalize } from "@/lib/search";
import { Plus, Search, Phone, Mail, MapPin, User, Edit2, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", city: "", notes: "" });
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  const filtered = suppliers.filter(p =>
    normalize(p.name).includes(normalize(searchQuery)) ||
    (p.contact_person && normalize(p.contact_person).includes(normalize(searchQuery)))
  );

  const load = useCallback(async () => {
    try { setSuppliers(await getSuppliers()); }
    catch { toast.error("Error al cargar proveedores"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ name: "", contact_person: "", phone: "", email: "", city: "", notes: "" });
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("El nombre del proveedor es obligatorio"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateSupplier(editingId, form);
        toast.success("Proveedor actualizado");
      } else {
        await createSupplier(form);
        toast.success("Proveedor creado");
      }
      setShowForm(false);
      resetForm();
      load();
    } catch {
      toast.error("Error al guardar");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSupplier(id);
      toast.success("Proveedor eliminado");
      setShowConfirmDelete(null);
      load();
    } catch { toast.error("Error al eliminar"); }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Proveedores</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Registro de proveedores y distribuidores</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
        >
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o contacto..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <p className="text-sm">{searchQuery ? "No se encontraron proveedores" : "No hay proveedores registrados"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[#5C3E35] font-semibold">{p.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(p.id); setForm({ name: p.name, contact_person: p.contact_person || "", phone: p.phone || "", email: p.email || "", city: p.city || "", notes: p.notes || "" }); setShowForm(true); }} className="p-1.5 text-[#9C8A82] hover:bg-[#FAF6F0] rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => setShowConfirmDelete(p.id)} className="p-1.5 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-[#9C8A82]">
                {p.phone && <div className="flex items-center gap-2"><Phone size={14} /><span>{p.phone}</span></div>}
                {p.email && <div className="flex items-center gap-2"><Mail size={14} /><span>{p.email}</span></div>}
                {p.city && <div className="flex items-center gap-2"><MapPin size={14} /><span>{p.city}</span></div>}
              </div>
              {p.contact_person && (
                <p className="mt-3 text-xs text-[#B8837E] flex items-center gap-1"><User size={12} /> {p.contact_person}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? "Editar Proveedor" : "Nuevo Proveedor"}>
        <div className="space-y-4">
          {([
            ["name", "Nombre del proveedor", "text"],
            ["contact_person", "Persona de contacto", "text"],
            ["phone", "Teléfono", "text"],
            ["email", "Correo electrónico", "email"],
            ["city", "Ciudad", "text"],
          ] as const).map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={16} />
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showConfirmDelete} onClose={() => setShowConfirmDelete(null)} title="Confirmar Eliminación">
        <div className="space-y-5">
          <p className="text-sm text-[#5C3E35]">¿Estás seguro de eliminar este proveedor? Las compras asociadas conservarán el nombre.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowConfirmDelete(null)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={() => showConfirmDelete && handleDelete(showConfirmDelete)} className="flex-1 h-12 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm">Eliminar</button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
