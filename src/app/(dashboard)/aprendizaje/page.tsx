"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import { Plus, Search, Trash2, Edit3, Lightbulb, Tag } from "lucide-react";
import toast from "react-hot-toast";

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem("almaia_learning_notes") || "[]");
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem("almaia_learning_notes", JSON.stringify(notes));
}

export default function AprendizajePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: "", content: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [filterTag, setFilterTag] = useState("");

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const allTags = [...new Set(notes.flatMap((n) => n.tags ? n.tags.split(",").map((t) => t.trim()).filter(Boolean) : []))].sort();

  const filtered = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    if (q && !n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    if (filterTag && !n.tags.includes(filterTag)) return false;
    return true;
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  function resetForm() {
    setForm({ title: "", content: "", tags: "" });
    setEditingNote(null);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setForm({ title: note.title, content: note.content, tags: note.tags });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.title.trim()) { toast.error("El título es requerido"); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let all = loadNotes();
      if (editingNote) {
        all = all.map((n) => n.id === editingNote.id ? { ...n, title: form.title, content: form.content, tags: form.tags, updated_at: now } : n);
        toast.success("Nota actualizada");
      } else {
        all.unshift({ id: crypto.randomUUID(), title: form.title, content: form.content, tags: form.tags, created_at: now, updated_at: now });
        toast.success("Nota guardada");
      }
      saveNotes(all);
      setNotes(all);
      setShowModal(false);
      resetForm();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    const all = loadNotes().filter((n) => n.id !== id);
    saveNotes(all);
    setNotes(all);
    toast.success("Nota eliminada");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Notas de Aprendizaje</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Lecciones aprendidas, errores que no repetir, ideas</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
        >
          <Plus size={18} /> Nueva Nota
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en notas..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
          />
        </div>
        {allTags.length > 0 && (
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
          >
            <option value="">Todas las etiquetas</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9C8A82]">
          <Lightbulb size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery || filterTag ? "Sin resultados" : "No hay notas aún. ¡Crea tu primera lección aprendida!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-[#5C3E35] line-clamp-2">{note.title}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(note)} className="p-1.5 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(note.id)} className="p-1.5 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-xs text-[#5C3E35] leading-relaxed whitespace-pre-wrap line-clamp-4 mb-3">{note.content}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {note.tags ? note.tags.split(",").map((t, i) => (
                    <span key={i}
                      onClick={() => setFilterTag(t.trim())}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#B8837E]/10 text-[#B8837E] cursor-pointer hover:bg-[#B8837E]/20 transition-all"
                    >
                      {t.trim()}
                    </span>
                  )) : null}
                </div>
                <span className="text-[10px] text-[#9C8A82]">{formatDate(note.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingNote ? "Editar Nota" : "Nueva Nota"} subtitle="Registra lo que has aprendido">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Título *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: No olvidar verificar ITBIS en facturas"
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Nota / Lección</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6}
              placeholder="Describe lo que aprendiste, el error que cometiste, o la idea que quieres recordar..."
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Etiquetas (separadas por coma)</label>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
              <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="facturas, ITBIS, clientes"
                className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowModal(false); resetForm(); }} className="px-5 h-11 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-5 h-11 rounded-xl bg-[#B8837E] text-white text-sm font-medium hover:bg-[#9A6B66] transition-all disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Nota"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
