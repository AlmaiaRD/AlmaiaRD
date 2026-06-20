"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getSettings, updateSettings, getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from "@/services/settings";
import type { Settings, BankAccount } from "@/types/database";
import { Save, Plus, Trash2, Building2, Upload, Download, Database, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";


type Tab = "general" | "banks" | "backup";

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
    default_margin: 30,
    invoice_prefix: "FAC-",
    receipt_prefix: "REC-",
    purchase_prefix: "COM-",
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
          {([["general", "Datos del Negocio"], ["banks", "Cuentas Bancarias"], ["backup", "Backup"]] as [Tab, string][]).map(([key, label]) => (
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
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Email</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@almaia-rd.com"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Teléfono</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="809-XXX-XXXX"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
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