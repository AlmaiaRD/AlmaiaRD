"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { Save } from "lucide-react";
import { createClient, updateClient } from "@/services/clients";
import type { Client, ClientType } from "@/types/database";
import toast from "react-hot-toast";

export interface ClientFormValues {
  full_name: string;
  phone: string;
  email: string;
  ibo_number: string;
  notes: string;
  client_type: ClientType;
  birthday: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
  initial?: Partial<ClientFormValues>;
  clientId?: string;
  title?: string;
  subtitle?: string;
  saveLabel?: string;
}

const emptyForm = (): ClientFormValues => ({
  full_name: "",
  phone: "",
  email: "",
  ibo_number: "",
  notes: "",
  client_type: "comprador",
  birthday: "",
});

export default function ClientFormModal({
  isOpen,
  onClose,
  onSaved,
  initial,
  clientId,
  title = "Nuevo Cliente",
  subtitle = "Registra la información del cliente",
  saveLabel,
}: Props) {
  const [form, setForm] = useState<ClientFormValues>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? { ...emptyForm(), ...initial } : emptyForm());
      setSaving(false);
    }
  }, [isOpen, initial]);

  async function handleSave() {
    if (!form.full_name.trim()) {
      toast.error("El nombre del cliente es requerido");
      return;
    }
    setSaving(true);
    try {
      const client = clientId
        ? await updateClient(clientId, { ...form, birthday: form.birthday || null })
        : await createClient({ ...form, birthday: form.birthday || null });
      onSaved(client);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Tipo de cliente *</label>
          <div className="flex gap-3">
            {([["comprador", "Cliente Comprador", "Compra productos"], ["negocio", "Prospecto de Negocio", "Posible IBO / Demo"]] as const).map(([value, label, desc]) => (
              <button key={value} type="button" onClick={() => setForm({ ...form, client_type: value })}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${form.client_type === value ? "border-[#B8837E] bg-[#B8837E]/5" : "border-[#E8E0D8] bg-white hover:bg-[#FAF6F0]"}`}>
                <p className="text-sm font-medium text-[#5C3E35]">{label}</p>
                <p className="text-xs text-[#9C8A82] mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Nombre completo *</label>
          <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nombre y apellidos" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Teléfono</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="809-000-0000" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Correo electrónico</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha de cumpleaños</label>
          <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Número IBO (opcional)</label>
          <input type="text" value={form.ibo_number} onChange={(e) => setForm({ ...form, ibo_number: e.target.value })} placeholder="IBO" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Información adicional del cliente..." rows={3} className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : (saveLabel || "Guardar")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
