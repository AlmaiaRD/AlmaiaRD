"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getSettings, updateSettings, getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from "@/services/settings";
import type { Settings, BankAccount } from "@/types/database";
import { Save, Plus, Trash2, Building2, Upload, Download, Database, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";


type Tab = "general" | "ai" | "banks" | "backup";

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const [form, setForm] = useState({
    business_name: "Almaia RD",
    logo_url: "",
    signature_url: "",
    email: "",
    phone: "",
    sender_name: "",
    default_margin: 30,
    invoice_prefix: "FAC-",
    receipt_prefix: "REC-",
    purchase_prefix: "COM-",
    email_template: `Hola, {{clientName}}.

Espero que te encuentres muy bien.

Te comparto adjunta {{label}} correspondiente a tu transacción realizada en {{businessName}}.

Si tienes alguna duda o necesitas asistencia, estaré encantada de ayudarte.

Muchas gracias por tu confianza.

Saludos,
{{senderName}}`,
    whatsapp_template: `Hola {{clientName}} 👋

Te envío {{label}} {{documentNumber}} por un total de {{total}}.

Gracias por tu confianza.

{{businessName}}`,
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    smtp_secure: false,
    ai_client_prompt: `Eres un asesor de ventas de Amway. Genera un análisis breve en español para el vendedor sobre este cliente:

Cliente: {{clientName}}
Etapa: {{stage}}
Total facturado: RD\${{totalSpent}}
Deuda pendiente: RD\${{pendingBalance}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Responde SOLO en este formato (máximo 4 líneas):
RESUMEN: [2 oraciones sobre el cliente]
ABORDAJE: [1 sugerencia de cómo contactarlo y qué ofrecerle]`,
    ai_learning_prompt: `Eres un coach de negocios. Basado en esta nota de aprendizaje, genera una reflexión útil y un consejo práctico:

Título: {{title}}
Contenido: {{content}}
Etiquetas: {{tags}}

Responde en español en máximo 3 oraciones:`,
  });

  const [newBank, setNewBank] = useState({
    bank_name: "",
    account_type: "",
    account_number: "",
    holder_name: "",
    id_number: "",
    email: "",
    is_default: false,
  });

  const [editingBank, setEditingBank] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const settingsData = await getSettings();
      const banksData = await getBankAccounts();

      if (settingsData) {
        setSettings(settingsData);
        setForm({
          business_name: settingsData.business_name || "Almaia RD",
          logo_url: settingsData.logo_url || "",
          signature_url: settingsData.signature_url || "",
          email: (settingsData as any).email || "",
          phone: (settingsData as any).phone || "",
          sender_name: (settingsData as any).sender_name || "",
          email_template: (settingsData as any).email_template || `Hola, {{clientName}}.\n\nEspero que te encuentres muy bien.\n\nTe comparto adjunta {{label}} correspondiente a tu transacción realizada en {{businessName}}.\n\nSi tienes alguna duda o necesitas asistencia, estaré encantada de ayudarte.\n\nMuchas gracias por tu confianza.\n\nSaludos,\n{{senderName}}`,
          whatsapp_template: (settingsData as any).whatsapp_template || `Hola {{clientName}} 👋\n\nTe envío {{label}} {{documentNumber}} por un total de {{total}}.\n\nGracias por tu confianza.\n\n{{businessName}}`,
          smtp_host: (settingsData as any).smtp_host || "",
          smtp_port: (settingsData as any).smtp_port || 587,
          smtp_user: (settingsData as any).smtp_user || "",
          smtp_pass: (settingsData as any).smtp_pass || "",
          smtp_secure: (settingsData as any).smtp_secure || false,
          ai_client_prompt: (settingsData as any).ai_client_prompt || `Eres un asesor de ventas de Amway. Genera un análisis breve en español para el vendedor sobre este cliente:

Cliente: {{clientName}}
Etapa: {{stage}}
Total facturado: RD\${{totalSpent}}
Deuda pendiente: RD\${{pendingBalance}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Responde SOLO en este formato (máximo 4 líneas):
RESUMEN: [2 oraciones sobre el cliente]
ABORDAJE: [1 sugerencia de cómo contactarlo y qué ofrecerle]`,
          ai_learning_prompt: (settingsData as any).ai_learning_prompt || `Eres un coach de negocios. Basado en esta nota de aprendizaje, genera una reflexión útil y un consejo práctico:

Título: {{title}}
Contenido: {{content}}
Etiquetas: {{tags}}

Responde en español en máximo 3 oraciones:`,
          default_margin: settingsData.default_margin || 30,
          invoice_prefix: settingsData.invoice_prefix || "FAC-",
          receipt_prefix: settingsData.receipt_prefix || "REC-",
          purchase_prefix: settingsData.purchase_prefix || "COM-",
        });
      }
      setBanks(banksData as BankAccount[]);
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) {
      toast.error("No hay configuración cargada. Recarga la página.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: settings.id,
        business_name: form.business_name,
        logo_url: form.logo_url,
        signature_url: form.signature_url,
        email: form.email,
        phone: form.phone,
        sender_name: form.sender_name,
        email_template: form.email_template,
        whatsapp_template: form.whatsapp_template,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_pass: form.smtp_pass,
        smtp_secure: form.smtp_secure,
        ai_client_prompt: form.ai_client_prompt,
        ai_learning_prompt: form.ai_learning_prompt,
        default_margin: form.default_margin,
        invoice_prefix: form.invoice_prefix,
        receipt_prefix: form.receipt_prefix,
        purchase_prefix: form.purchase_prefix,
      };
      const result = await updateSettings(payload);
      setSettings(result);
      toast.success("Configuración guardada");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err?.message || "Error al guardar configuración");
    } finally { setSaving(false); }
  }

  async function handleAddBank() {
    if (!newBank.bank_name || !newBank.account_number) {
      toast.error("Banco y número de cuenta son requeridos"); return;
    }
    try {
      if (editingBank) {
        await updateBankAccount(editingBank, {
          bank_name: newBank.bank_name,
          account_type: newBank.account_type,
          account_number: newBank.account_number,
          holder_name: newBank.holder_name,
          id_number: newBank.id_number,
          email: newBank.email,
        });
        setBanks(banks.map((b) => b.id === editingBank ? { ...b, ...newBank } : b));
        toast.success("Cuenta bancaria actualizada");
        setEditingBank(null);
      } else {
        const created = await createBankAccount(newBank);
        setBanks([...banks, created as BankAccount]);
        toast.success("Cuenta bancaria agregada");
      }
      setNewBank({ bank_name: "", account_type: "", account_number: "", holder_name: "", id_number: "", email: "", is_default: false });
    } catch {
      toast.error(editingBank ? "Error al actualizar cuenta" : "Error al agregar cuenta bancaria");
    }
  }

  function openEditBank(bank: BankAccount) {
    setEditingBank(bank.id);
    setNewBank({
      bank_name: bank.bank_name,
      account_type: bank.account_type,
      account_number: bank.account_number,
      holder_name: bank.holder_name,
      id_number: (bank as any).id_number || "",
      email: (bank as any).email || "",
      is_default: bank.is_default || false,
    });
  }

  function cancelEditBank() {
    setEditingBank(null);
    setNewBank({ bank_name: "", account_type: "", account_number: "", holder_name: "", id_number: "", email: "", is_default: false });
  }

  async function handleDeleteBank(id: string) {
    try {
      await deleteBankAccount(id);
      setBanks(banks.filter((b) => b.id !== id));
      toast.success("Cuenta bancaria eliminada");
    } catch {
      toast.error("Error al eliminar cuenta bancaria");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await updateBankAccount(id, { is_default: true });
      setBanks(banks.map((b) => ({ ...b, is_default: b.id === id })));
      toast.success("Cuenta predeterminada actualizada");
    } catch {
      toast.error("Error al actualizar cuenta");
    }
  }

  async function handleExportBackup() {
    try {
      const [clients, products, invoices, receipts, purchases, expenses, bonuses, followups] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("products").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("receipts").select("*"),
        supabase.from("purchases").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("bonuses").select("*"),
        supabase.from("followups").select("*"),
      ]);
      const backup = {
        version: "1.0",
        date: new Date().toISOString(),
        data: {
          clients: clients.data || [],
          products: products.data || [],
          invoices: invoices.data || [],
          receipts: receipts.data || [],
          purchases: purchases.data || [],
          expenses: expenses.data || [],
          bonuses: bonuses.data || [],
          followups: followups.data || [],
        },
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `almaia-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado exitosamente");
    } catch {
      toast.error("Error al exportar backup");
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#5C3E35]">Configuración</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Personaliza tu sistema</p>
      </div>

      <div className="border-b border-[#E8E0D8] mb-6">
        <div className="flex gap-6">
          {([["general", "Datos del Negocio"], ["ai", "Prompts IA"], ["banks", "Cuentas Bancarias"], ["backup", "Backup"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === key ? "text-[#B8837E] border-b-2 border-[#B8837E]" : "text-[#9C8A82] hover:text-[#5C3E35]"
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {activeTab === "general" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8] space-y-5">
            <h3 className="text-sm font-semibold text-[#5C3E35]">Información del Negocio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Nombre del Negocio</label>
                <input type="text" value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Margen Predeterminado</label>
                <select value={form.default_margin}
                  onChange={(e) => setForm({ ...form, default_margin: Number(e.target.value) })}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
                  <option value={30}>30%</option>
                  <option value={35}>35%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Email de envío</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@almaia-rd.com"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Nombre del remitente</label>
                <input type="text" value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  placeholder="Yrahisa Mateo"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
            </div>

            <div className="border-t border-[#E8E0D8] pt-5">
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Plantillas de Mensajes</h4>
              <p className="text-xs text-[#9C8A82] mb-4">Usa <code className="text-[#B8837E]">{"{{clientName}}"}</code>, <code className="text-[#B8837E]">{"{{documentNumber}}"}</code>, <code className="text-[#B8837E]">{"{{businessName}}"}</code>, <code className="text-[#B8837E]">{"{{senderName}}"}</code>, <code className="text-[#B8837E]">{"{{total}}"}</code>, <code className="text-[#B8837E]">{"{{label}}"}</code></p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Plantilla Email</label>
                  <textarea value={form.email_template} rows={8}
                    onChange={(e) => setForm({ ...form, email_template: e.target.value })}
                    placeholder="Hola, {{clientName}}..."
                    className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Plantilla WhatsApp</label>
                  <textarea value={form.whatsapp_template} rows={5}
                    onChange={(e) => setForm({ ...form, whatsapp_template: e.target.value })}
                    placeholder="Hola {{clientName}}..."
                    className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E8E0D8] pt-5">
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Servidor SMTP (Gmail)</h4>
              <p className="text-xs text-[#9C8A82] mb-4">Configuración para enviar correos realmente. Para Gmail usa <strong>smtp.gmail.com</strong>, puerto <strong>587</strong>, y una <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="text-[#B8837E] underline">Contraseña de Aplicación</a> de Google.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Servidor SMTP</label>
                  <input type="text" value={form.smtp_host}
                    onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Puerto</label>
                  <input type="number" value={form.smtp_port}
                    onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
                    placeholder="587"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Usuario (correo)</label>
                  <input type="text" value={form.smtp_user}
                    onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                    placeholder="tucorreo@gmail.com"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Contraseña / App Password</label>
                  <input type="password" value={form.smtp_pass}
                    onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                    placeholder="••••••••"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div className="flex items-center gap-3 h-11">
                  <input type="checkbox" id="smtp_secure" checked={form.smtp_secure}
                    onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                    className="w-4 h-4 rounded border-[#E8E0D8] text-[#B8837E] focus:ring-[#B8837E]/30" />
                  <label htmlFor="smtp_secure" className="text-xs text-[#5C3E35]">Usar SSL (puerto 465)</label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Logo del Negocio</label>
                <div className="flex items-center gap-3">
                  {form.logo_url && (
                    <img src={form.logo_url} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-[#E8E0D8]" />
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-dashed border-[#E8E0D8] bg-[#FCFAF7] text-[#9C8A82] text-sm cursor-pointer hover:bg-[#FAF6F0] hover:border-[#B8837E]/30 transition-all">
                    <Upload size={16} />
                    {form.logo_url ? "Cambiar logo" : "Subir logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setForm({ ...form, logo_url: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Firma Digital</label>
                <div className="flex items-center gap-3">
                  {form.signature_url && (
                    <img src={form.signature_url} alt="Firma" className="w-14 h-14 rounded-xl object-cover border border-[#E8E0D8]" />
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-dashed border-[#E8E0D8] bg-[#FCFAF7] text-[#9C8A82] text-sm cursor-pointer hover:bg-[#FAF6F0] hover:border-[#B8837E]/30 transition-all">
                    <Upload size={16} />
                    {form.signature_url ? "Cambiar firma" : "Subir firma"}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setForm({ ...form, signature_url: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E8E0D8] pt-5">
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Prefijos de Documentos</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Facturas</label>
                  <input type="text" value={form.invoice_prefix}
                    onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Recibos</label>
                  <input type="text" value={form.receipt_prefix}
                    onChange={(e) => setForm({ ...form, receipt_prefix: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9C8A82] mb-1">Compras</label>
                  <input type="text" value={form.purchase_prefix}
                    onChange={(e) => setForm({ ...form, purchase_prefix: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 bg-[#B8837E] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">
            <Save size={18} /> {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      )}

      {activeTab === "ai" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8] space-y-6">
            <h3 className="text-sm font-semibold text-[#5C3E35]">Prompts de Inteligencia Artificial</h3>
            <p className="text-xs text-xs text-[#9C8A82]">
              Personaliza los prompts que usa la IA para generar resúmenes de clientes y analizar notas de aprendizaje.
              Usa variables entre llaves dobles: <code className="text-[#B8837E] bg-[#FAF6F0] px-1.5 py-0.5 rounded text-[10px]">{"{{clientName}}"}</code>, <code className="text-[#B8837E] bg-[#FAF6F0] px-1.5 py-0.5 rounded text-[10px]">{"{{totalSpent}}"}</code>, etc.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-2">Prompt para Resumen de Cliente</label>
              <p className="text-[10px] text-[#9C8A82] mb-2">Se usa al generar resúmenes en Pipeline y reportes.</p>
              <textarea
                value={form.ai_client_prompt}
                onChange={(e) => setForm({ ...form, ai_client_prompt: e.target.value })}
                rows={10}
                placeholder="Eres un asesor de ventas de Amway. Genera un resumen profesional en español (2-3 oraciones) sobre este cliente:

Nombre: {{clientName}}
Etapa: {{stage}}
Total facturado: RD${{totalSpent}}
Total pagado: RD${{totalPaid}}
Facturas pendientes: {{pendingCount}}
Ticket promedio: RD${{avgTicket}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Destaca el valor del cliente, su comportamiento de pago, y sugiere oportunidades de venta."
                className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 font-mono text-[11px]"
              />
            </div>

            <div className="border-t border-[#E8E0D8] pt-6">
              <label className="block text-xs font-medium text-[#9C8A82] mb-2">Prompt para Notas de Aprendizaje</label>
              <p className="text-[10px] text-[#9C8A82] mb-2">Se usa al analizar notas en el módulo de Aprendizaje.</p>
              <textarea
                value={form.ai_learning_prompt}
                onChange={(e) => setForm({ ...form, ai_learning_prompt: e.target.value })}
                rows={8}
                placeholder="Eres un mentor de ventas. Analiza esta nota de aprendizaje y extrae la lección clave, el error cometido, y una acción correctiva concreta en español (máx. 3 oraciones):

Título: {{title}}
Contenido: {{content}}
Etiquetas: {{tags}}

Responde en formato:
LECCIÓN: ...
ERROR: ...
ACCIÓN: ..."
                className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 font-mono text-[11px]"
              />
            </div>

            <div className="bg-[#FAF6F0] rounded-xl p-4 border border-[#E8E0D8]">
              <h4 className="text-xs font-semibold text-[#5C3E35] mb-2">Variables disponibles</h4>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-[#9C8A82] font-mono">
                <span>{"{{clientName}}"}</span><span>{"{{stage}}"}</span>
                <span>{"{{totalSpent}}"}</span><span>{"{{totalPaid}}"}</span>
                <span>{"{{pendingCount}}"}</span><span>{"{{avgTicket}}"}</span>
                <span>{"{{numPurchases}}"}</span><span>{"{{topProducts}}"}</span>
                <span>{"{{title}}"}</span><span>{"{{content}}"}</span>
                <span>{"{{tags}}"}</span><span>{"{{senderName}}"}</span>
                <span>{"{{businessName}}"}</span><span>{"{{documentNumber}}"}</span>
                <span>{"{{total}}"}</span><span>{"{{label}}"}</span>
              </div>
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 bg-[#B8837E] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50">
            <Save size={18} /> {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      )}

      {activeTab === "banks" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">{editingBank ? "Editar Cuenta Bancaria" : "Agregar Cuenta Bancaria"}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Banco</label>
                <input type="text" value={newBank.bank_name}
                  onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
                  placeholder="Ej: Banco Popular Dominicano"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Tipo de Cuenta</label>
                <input type="text" value={newBank.account_type}
                  onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value })}
                  placeholder="Ej: Cuenta Corriente DOP"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Número de Cuenta</label>
                <input type="text" value={newBank.account_number}
                  onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                  placeholder="Ej: 772922126"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Titular</label>
                <input type="text" value={newBank.holder_name}
                  onChange={(e) => setNewBank({ ...newBank, holder_name: e.target.value })}
                  placeholder="Ej: Yrahisa Mateo"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Cédula / RNC</label>
                <input type="text" value={newBank.id_number}
                  onChange={(e) => setNewBank({ ...newBank, id_number: e.target.value })}
                  placeholder="Ej: 001-1234567-8"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Correo Electrónico</label>
                <input type="email" value={newBank.email}
                  onChange={(e) => setNewBank({ ...newBank, email: e.target.value })}
                  placeholder="Ej: correo@ejemplo.com"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddBank}
                className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
                <Save size={18} /> {editingBank ? "Actualizar Cuenta" : "Agregar Cuenta"}
              </button>
              {editingBank && (
                <button onClick={cancelEditBank}
                  className="px-5 py-2.5 rounded-xl border border-[#E8E0D8] text-[#5C3E35] text-sm font-medium hover:bg-[#FAF6F0] transition-all">
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {banks.length === 0 ? (
              <div className="text-center py-12 text-[#9C8A82] bg-white rounded-2xl border border-[#E8E0D8]">
                <Building2 size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hay cuentas bancarias registradas</p>
              </div>
            ) : (
              banks.map((bank) => (
                <div key={bank.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#5C3E35]">{bank.bank_name}</p>
                    <p className="text-sm text-[#9C8A82]">{bank.account_type} — {bank.account_number}</p>
                    <p className="text-xs text-[#9C8A82]">{bank.holder_name}</p>
                    {(bank as any).id_number && <p className="text-xs text-[#9C8A82]">Cédula: {(bank as any).id_number}</p>}
                    {(bank as any).email && <p className="text-xs text-[#9C8A82]">{(bank as any).email}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {bank.is_default ? (
                      <span className="text-xs bg-[#86C7A3]/10 text-[#86C7A3] px-3 py-1 rounded-full font-medium">Predeterminada</span>
                    ) : (
                      <button onClick={() => handleSetDefault(bank.id)}
                        className="text-xs text-[#9C8A82] hover:text-[#B8837E] transition-colors">Establecer como predeterminada</button>
                    )}
                    <button onClick={() => openEditBank(bank)}
                      className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteBank(bank.id)}
                      className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "backup" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Database size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#5C3E35]">Exportar Backup</h3>
                <p className="text-xs text-[#9C8A82]">Descarga todos los datos del sistema en formato JSON</p>
              </div>
            </div>
            <button onClick={handleExportBackup}
              className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              <Download size={18} /> Descargar Backup
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Upload size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#5C3E35]">Importar Backup</h3>
                <p className="text-xs text-[#9C8A82]">Restaura datos desde un archivo JSON de backup</p>
              </div>
            </div>
            <input type="file" accept=".json" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const backup = JSON.parse(text);
                if (!backup.data) { toast.error("Archivo de backup inválido"); return; }
                toast.success("Backup importado (funcionalidad en desarrollo)");
              } catch {
                toast.error("Error al leer el archivo");
              }
            }}
              className="block w-full text-sm text-[#9C8A82] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#FAF6F0] file:text-[#5C3E35] hover:file:bg-[#F0EBE3]" />
          </div>
        </div>
      )}
    </PageContainer>
  );
}