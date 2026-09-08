"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import {
  getTelegramConfigs,
  createTelegramConfig,
  deleteTelegramConfig,
  sendViaTelegramApi,
  getTelegramLogs,
  registerTelegramWebhook,
  type TelegramConfig,
  type TelegramLogRow,
} from "@/services/telegram";
import { formatDate } from "@/lib/utils";
import { getClients, getClientsWithBalances } from "@/services/clients";
import { uploadMediaFile } from "@/services/media";
import { friendlyTelegramError } from "@/lib/communication-errors";
import type { Client } from "@/types/database";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate as deleteTemplateRow,
  applyTemplate,
  type CommunicationTemplate,
} from "@/services/templates";
import {
  Send,
  Settings,
  History,
  Plus,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Users,
  Bookmark,
  Zap,
  FileText,
  Edit3,
  Eye,
  Copy,
  ChevronDown,
  MessageCircle,
  Clock,
  CheckCircle,
  CheckCheck,
  AlertCircle,
  Paperclip,
  Megaphone,
  Handshake,
  Gift,
  Heart,
  Star,
  Bell,
  Tag,
  Truck,
  Shield,
  ShoppingCart,
  Sparkles,
  CreditCard,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface QuickAction {
  id: string;
  name: string;
  description: string;
  iconName: string;
  color: string;
  bgColor: string;
  message: string;
  type: "text" | "template";
  isDefault: boolean;
}

const ICON_OPTIONS = [
  { name: "Send", icon: Send, color: "text-blue-600", bgColor: "bg-blue-50" },
  { name: "FileText", icon: FileText, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  { name: "Clock", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50" },
  { name: "MessageCircle", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-50" },
  { name: "Megaphone", icon: Megaphone, color: "text-pink-600", bgColor: "bg-pink-50" },
  { name: "Handshake", icon: Handshake, color: "text-teal-600", bgColor: "bg-teal-50" },
  { name: "Gift", icon: Gift, color: "text-purple-600", bgColor: "bg-purple-50" },
  { name: "Heart", icon: Heart, color: "text-red-500", bgColor: "bg-red-50" },
  { name: "Star", icon: Star, color: "text-yellow-500", bgColor: "bg-yellow-50" },
  { name: "Bell", icon: Bell, color: "text-orange-500", bgColor: "bg-orange-50" },
  { name: "Tag", icon: Tag, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  { name: "Truck", icon: Truck, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { name: "Shield", icon: Shield, color: "text-slate-600", bgColor: "bg-slate-50" },
  { name: "ShoppingCart", icon: ShoppingCart, color: "text-violet-600", bgColor: "bg-violet-50" },
  { name: "Sparkles", icon: Sparkles, color: "text-fuchsia-600", bgColor: "bg-fuchsia-50" },
  { name: "CreditCard", icon: CreditCard, color: "text-lime-600", bgColor: "bg-lime-50" },
  { name: "Calendar", icon: Calendar, color: "text-sky-600", bgColor: "bg-sky-50" },
  { name: "Users", icon: Users, color: "text-rose-600", bgColor: "bg-rose-50" },
  { name: "Zap", icon: Zap, color: "text-amber-600", bgColor: "bg-amber-50" },
];

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "invoice",
    name: "Enviar Factura",
    description: "Envía una factura",
    iconName: "FileText",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    message: "Hola {cliente}, te envío la factura #{numero} por un total de RD${monto}. ¡Gracias por tu compra!",
    type: "text",
    isDefault: true,
  },
  {
    id: "payment_reminder",
    name: "Recordatorio de Pago",
    description: "Envía un recordatorio de pago",
    iconName: "Clock",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    message: "Hola {cliente}, te recordamos que tienes un saldo pendiente de RD${monto}. Si ya realizaste el pago, ignora este mensaje.",
    type: "text",
    isDefault: true,
  },
  {
    id: "welcome",
    name: "Mensaje de Bienvenida",
    description: "Envía un mensaje de bienvenida",
    iconName: "MessageCircle",
    color: "text-green-600",
    bgColor: "bg-green-50",
    message: "¡Bienvenido/a a Almaia RD! {cliente}, somos distribuidores autorizados Amway. ¿En qué podemos ayudarte?",
    type: "text",
    isDefault: true,
  },
  {
    id: "promotion",
    name: "Promoción",
    description: "Envía una promoción especial",
    iconName: "Megaphone",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    message: "¡Hola {cliente}! 🌟 Tenemos una promoción especial para ti: {detalle}. ¡No te lo pierdas!",
    type: "text",
    isDefault: true,
  },
  {
    id: "follow_up",
    name: "Seguimiento",
    description: "Realiza seguimiento a un cliente",
    iconName: "Heart",
    color: "text-red-500",
    bgColor: "bg-red-50",
    message: "Hola {cliente}, ¿cómo te fue con tu última compra? Me encantaría saber tu experiencia con los productos. ¿Hay algo en lo que pueda ayudarte?",
    type: "text",
    isDefault: true,
  },
];

function getIconComponent(iconName: string) {
  const found = ICON_OPTIONS.find((i) => i.name === iconName);
  return found || ICON_OPTIONS[0];
}

const QUICK_ACTIONS_STORAGE_KEY = "almaia_telegram_quick_actions";

type Tab = "send" | "templates" | "actions" | "configs" | "logs";

export default function TelegramPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<TelegramConfig[]>([]);
  const [logs, setLogs] = useState<TelegramLogRow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("send");
  const [selectedConfig, setSelectedConfig] = useState<TelegramConfig | null>(null);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ label: "", bot_token: "", owner_chat_id: "", is_active: true });
  const [chatId, setChatId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [recipientMode, setRecipientMode] = useState<"manual" | "client" | "all">("manual");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [telegramClients, setTelegramClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);

  // Media adjunta al mensaje
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaDisposition, setMediaDisposition] = useState<"photo" | "document" | "video" | "audio">("photo");

  // Envío masivo / resultados
  const [sendResults, setSendResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [reminderSending, setReminderSending] = useState(false);

  // Plantillas (BD unificada, compartidas entre WhatsApp, Telegram y Email)
  const [localTemplates, setLocalTemplates] = useState<CommunicationTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", message: "", category: "General", variables: "" });
  const [previewTemplate, setPreviewTemplate] = useState<CommunicationTemplate | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Quick actions
  const [quickActions, setQuickActions] = useState<QuickAction[]>(() => {
    try {
      const storedActions = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
      if (storedActions) return JSON.parse(storedActions);
    } catch { /* ignore */ }
    return DEFAULT_QUICK_ACTIONS;
  });
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const [actionForm, setActionForm] = useState({ name: "", description: "", iconName: "Send", message: "", type: "text" as "text" | "template" });
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [configsData, logsData, clientsData, templatesData] = await Promise.all([
          getTelegramConfigs(),
          getTelegramLogs(),
          getClients(),
          getTemplates(),
        ]);
        setConfigs(configsData);
        setLogs(logsData);
        setLocalTemplates(templatesData);
        setAllClients(clientsData);
        setTelegramClients(clientsData.filter((c) => c.telegram_chat_id && c.telegram_chat_id.trim() !== ""));
        if (configsData.length > 0) {
          setSelectedConfig(configsData.find((c) => c.is_active) || configsData[0]);
        }
      } catch {
        toast.error("Error al cargar datos de Telegram");
      }
    }
    load();
  }, []);

  function saveQuickActions(actions: QuickAction[]) {
    setQuickActions(actions);
    localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(actions));
  }

  // ---- Template CRUD (BD unificada, compartida) ----
  function openCreateTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: "", message: "", category: "General", variables: "" });
    setShowTemplateModal(true);
  }

  function openEditTemplate(template: CommunicationTemplate) {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      message: template.message,
      category: template.category,
      variables: template.variables.join(", "),
    });
    setShowTemplateModal(true);
  }

  async function saveTemplate() {
    if (!templateForm.name.trim() || !templateForm.message.trim()) {
      toast.error("Nombre y mensaje son requeridos");
      return;
    }
    const vars = templateForm.variables
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          channel: editingTemplate.channel,
          name: templateForm.name,
          message: templateForm.message,
          category: templateForm.category,
          variables: vars,
        });
        setLocalTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id
              ? { ...t, name: templateForm.name, message: templateForm.message, category: templateForm.category, variables: vars }
              : t
          )
        );
        toast.success("Plantilla actualizada");
      } else {
        const created = await createTemplate({
          channel: "telegram",
          name: templateForm.name,
          message: templateForm.message,
          category: templateForm.category,
          variables: vars,
        });
        setLocalTemplates((prev) => [created, ...prev]);
        toast.success("Plantilla creada");
      }
    } catch {
      toast.error("Error al guardar la plantilla");
      return;
    }
    setShowTemplateModal(false);
  }

  async function deleteTemplate(id: string, isSystem?: boolean) {
    if (isSystem) {
      toast.error("Las plantillas predefinidas no se pueden eliminar, solo editar");
      return;
    }
    try {
      await deleteTemplateRow(id);
      setLocalTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Plantilla eliminada");
    } catch {
      toast.error("Error al eliminar la plantilla");
    }
  }

  function selectTemplate(template: CommunicationTemplate) {
    setSelectedTemplate(template.id);
    setMessageText(applyTemplate(template.message));
    setActiveTab("send");
    toast.success(`Plantilla "${template.name}" aplicada`);
  }

  // ---- Quick Actions CRUD ----
  function openCreateAction() {
    setEditingAction(null);
    setActionForm({ name: "", description: "", iconName: "Send", message: "", type: "text" });
    setShowActionModal(true);
    setShowIconPicker(false);
  }

  function openEditAction(action: QuickAction) {
    setEditingAction(action);
    setActionForm({ name: action.name, description: action.description, iconName: action.iconName, message: action.message, type: action.type });
    setShowActionModal(true);
    setShowIconPicker(false);
  }

  function saveAction() {
    if (!actionForm.name.trim() || !actionForm.message.trim()) {
      toast.error("Nombre y mensaje son requeridos");
      return;
    }
    const iconData = getIconComponent(actionForm.iconName);

    if (editingAction) {
      const updated = quickActions.map((a) =>
        a.id === editingAction.id
          ? { ...a, name: actionForm.name, description: actionForm.description, iconName: actionForm.iconName, color: iconData.color, bgColor: iconData.bgColor, message: actionForm.message, type: actionForm.type as "text" | "template" }
          : a
      );
      saveQuickActions(updated);
      toast.success("Acción actualizada");
    } else {
      const newAction: QuickAction = {
        id: Date.now().toString(),
        name: actionForm.name,
        description: actionForm.description,
        iconName: actionForm.iconName,
        color: iconData.color,
        bgColor: iconData.bgColor,
        message: actionForm.message,
        type: actionForm.type as "text" | "template",
        isDefault: false,
      };
      saveQuickActions([...quickActions, newAction]);
      toast.success("Acción creada");
    }
    setShowActionModal(false);
  }

  function deleteAction(id: string) {
    saveQuickActions(quickActions.filter((a) => a.id !== id));
    toast.success("Acción eliminada");
  }

  function executeQuickAction(action: QuickAction) {
    let msg = action.message;
    const varMatches = msg.match(/\{[^}]+\}/g);
    if (varMatches) {
      varMatches.forEach((v) => {
        const varName = v.replace(/[{}]/g, "");
        msg = msg.replace(v, `[${varName}]`);
      });
    }
    setMessageText(msg);
    setActiveTab("send");
    toast.success(`Acción "${action.name}" aplicada — edita el mensaje antes de enviar`);
  }

  async function handleAddConfig() {
    if (!configForm.label.trim() || !configForm.bot_token.trim()) {
      toast.error("Completa la etiqueta y el token del bot");
      return;
    }
    try {
      const newConfig = await createTelegramConfig({
        label: configForm.label.trim(),
        bot_token: configForm.bot_token.trim(),
        owner_chat_id: configForm.owner_chat_id.trim() || null,
      });
      setConfigs((prev) => [...prev, newConfig]);
      setShowAddConfig(false);
      setConfigForm({ label: "", bot_token: "", owner_chat_id: "", is_active: true });
      toast.success("Bot de Telegram agregado");
    } catch {
      toast.error("Error al guardar el bot de Telegram");
    }
  }

  async function handleDeleteConfig(id: string) {
    try {
      await deleteTelegramConfig(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      if (selectedConfig?.id === id) setSelectedConfig(configs[0] || null);
      toast.success("Bot de Telegram eliminado");
    } catch {
      toast.error("Error al eliminar el bot de Telegram");
    }
  }

  async function handleSend() {
    if (!selectedConfig) {
      toast.error("Selecciona un bot de Telegram");
      return;
    }
    if (!messageText.trim() && !mediaFile && !mediaUrl.trim()) {
      toast.error("Escribe un mensaje o adjunta un archivo");
      return;
    }
    const text = messageText.trim();

    let targets: { chatId: string; label: string }[] = [];
    if (recipientMode === "manual") {
      if (!chatId.trim()) {
        toast.error("Ingresa un chat_id de Telegram");
        return;
      }
      targets = [{ chatId: chatId.trim(), label: "manual" }];
    } else if (recipientMode === "client") {
      const selected = telegramClients.find((c) => c.id === selectedClientId);
      if (!selected) {
        toast.error("Selecciona un cliente de la lista");
        return;
      }
      targets = [{ chatId: selected.telegram_chat_id!, label: selected.full_name || "cliente" }];
    } else {
      if (telegramClients.length === 0) {
        toast.error("No hay clientes con Telegram configurado");
        return;
      }
      targets = telegramClients.map((c) => ({ chatId: c.telegram_chat_id!, label: c.full_name || "cliente" }));
    }

    // Resolver media (archivo → URL pública firmada) antes de enviar
    let finalMediaUrl = mediaUrl.trim();
    if (mediaFile) {
      const upload = await uploadMediaFile(mediaFile);
      if (upload.error) {
        toast.error(upload.error);
        return;
      }
      finalMediaUrl = upload.url || "";
    }
    const media =
      finalMediaUrl && (mediaFile || mediaUrl.trim())
        ? { mediaUrl: finalMediaUrl, mediaType: mediaDisposition }
        : undefined;

    setSending(true);
    setSendResults([]);
    try {
      let sent = 0;
      let failed = 0;
      const results: { name: string; ok: boolean; error?: string }[] = [];
      for (const target of targets) {
        const result = await sendViaTelegramApi(selectedConfig.id, target.chatId, text, media);
        if (result.success) {
          sent++;
          results.push({ name: target.label, ok: true });
        } else {
          failed++;
          results.push({ name: target.label, ok: false, error: friendlyTelegramError(result.error) });
        }
      }
      setSendResults(results);
      if (sent > 0) toast.success(`Enviado a ${sent} destinatario(s) por Telegram`);
      if (failed > 0) toast.error(`${failed} destinatario(s) no se pudieron enviar`);
      if (sent > 0) {
        setMessageText("");
        setSelectedTemplate("");
        setMediaFile(null);
        setMediaUrl("");
      }
      setLogs(await getTelegramLogs());
    } catch {
      toast.error("Error al enviar mensaje de Telegram");
    } finally {
      setSending(false);
    }
  }

  async function handleTelegramReminders() {
    if (!selectedConfig) {
      toast.error("Selecciona un bot de Telegram");
      return;
    }
    if (!messageText.trim()) {
      toast.error("Escribe el mensaje del recordatorio");
      return;
    }
    setReminderSending(true);
    setSendResults([]);
    try {
      const clientsWithBalance = await getClientsWithBalances();
      const pending = clientsWithBalance.filter(
        (c) => Number(c.pending_balance || 0) > 0 && c.telegram_chat_id && c.telegram_chat_id.trim() !== ""
      );
      if (pending.length === 0) {
        toast.success("No hay clientes con saldo pendiente y Telegram vinculado");
        return;
      }
      let sent = 0;
      let failed = 0;
      const results: { name: string; ok: boolean; error?: string }[] = [];
      for (const c of pending) {
        const msg = messageText
          .replace(/\{cliente\}/g, c.full_name || "cliente")
          .replace(/\{monto\}/g, `RD$ ${Number(c.pending_balance || 0).toLocaleString()}`);
        const r = await sendViaTelegramApi(selectedConfig.id, c.telegram_chat_id!, msg);
        if (r.success) {
          sent++;
          results.push({ name: c.full_name || "", ok: true });
        } else {
          failed++;
          results.push({ name: c.full_name || "", ok: false, error: friendlyTelegramError(r.error) });
        }
      }
      setSendResults(results);
      toast.success(`Recordatorios: ${sent} enviados · ${failed} fallidos`);
      setLogs(await getTelegramLogs());
    } catch {
      toast.error("Error al enviar los recordatorios");
    } finally {
      setReminderSending(false);
    }
  }

  async function handleRegisterWebhook() {
    if (!selectedConfig) {
      toast.error("Selecciona un bot de Telegram");
      return;
    }
    setWebhookLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await registerTelegramWebhook(selectedConfig.id, `${origin}/api/telegram/webhook`);
      if (result.success) {
        toast.success("Webhook registrado correctamente");
      } else {
        toast.error(result.error || "Error al registrar el webhook");
      }
    } catch {
      toast.error("Error al registrar el webhook");
    } finally {
      setWebhookLoading(false);
    }
  }

  const inputCls =
    "w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30";

  const templateCategories = ["General", ...Array.from(new Set(localTemplates.map((t) => t.category)))];

  return (
    <PageContainer>
      <div className="mb-8">
        <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver a CRM
        </button>
        <h1 className="text-2xl font-bold text-[#5C3E35]">Telegram</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Mensajes, bots y avisos por Telegram (gratuito)</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E8E0D8] pb-2 flex-wrap">
        {[
          { key: "send", label: "Enviar Mensaje", icon: Send },
          { key: "templates", label: "Plantillas", icon: Bookmark },
          { key: "actions", label: "Acciones Rápidas", icon: Zap },
          { key: "configs", label: "Bots y Webhook", icon: Settings },
          { key: "logs", label: "Historial", icon: History },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#B8837E]/10 text-[#B8837E]"
                : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== SEND TAB ===================== */}
      {activeTab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Enviar Mensaje por Telegram</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Bot de Telegram</label>
              <select
                value={selectedConfig?.id || ""}
                onChange={(e) => {
                  const config = configs.find((c) => c.id === e.target.value);
                  setSelectedConfig(config || null);
                }}
                className={inputCls}
              >
                <option value="">Seleccionar bot...</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.label} {config.is_active ? "(activo)" : "(inactivo)"}
                  </option>
                ))}
              </select>
            </div>

            {localTemplates.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Plantilla rápida</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const tpl = localTemplates.find((t) => t.id === e.target.value);
                    if (tpl) {
                      setSelectedTemplate(tpl.id);
                      let msg = tpl.message;
                      tpl.variables.forEach((v) => { msg = msg.replace(`{${v}}`, `[${v}]`); });
                      setMessageText(msg);
                    } else {
                      setSelectedTemplate("");
                    }
                  }}
                  className={inputCls}
                >
                  <option value="">Escribir mensaje manualmente...</option>
                  {localTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name} — {tpl.category}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Enviar a</label>
              <select
                value={recipientMode}
                onChange={(e) => setRecipientMode(e.target.value as "manual" | "client" | "all")}
                className={inputCls}
              >
                <option value="manual">Un chat_id manual</option>
                <option value="client">Un cliente de la lista</option>
                <option value="all">Todos los clientes con Telegram ({telegramClients.length})</option>
              </select>
            </div>

            {recipientMode === "manual" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Chat ID del destinatario</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Ej: 123456789 (consulta tu chat_id con /start)"
                  className={inputCls}
                />
              </div>
            )}

            {recipientMode === "client" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Cliente</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Seleccionar cliente...</option>
                  {telegramClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {recipientMode === "all" && (
              <div className="mb-4 p-3 rounded-xl bg-[#2AABEE]/5 border border-[#2AABEE]/20 text-xs text-[#5C3E35]">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#2AABEE]" />
                  Se enviará el mensaje a los {telegramClients.length} cliente(s) que tienen Telegram configurado.
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
              />
              {messageText && (
                <p className="text-xs text-[#9C8A82] mt-1">{messageText.length} caracteres</p>
              )}
            </div>

            {/* Adjunto (foto / documento / video / audio) */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Adjuntar (opcional)</label>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {(["photo", "document", "video", "audio"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMediaDisposition(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      mediaDisposition === t
                        ? "bg-[#2AABEE]/10 text-[#1D8FC9] border-[#2AABEE]"
                        : "text-[#9C8A82] border-[#E8E0D8] hover:bg-[#FAF6F0]"
                    }`}
                  >
                    {t === "photo" ? "Foto" : t === "document" ? "Documento" : t === "video" ? "Video" : "Audio"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="flex-1 flex items-center gap-2 h-10 px-4 rounded-xl border border-dashed border-[#E8E0D8] bg-[#FCFAF7] text-sm text-[#9C8A82] cursor-pointer hover:bg-[#FAF6F0] transition-all">
                  <Paperclip size={15} />
                  {mediaFile ? (
                    <span className="text-[#5C3E35] truncate">{mediaFile.name}</span>
                  ) : (
                    "Subir archivo (máx 8MB)"
                  )}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setMediaFile(f);
                      if (f) {
                        if (f.type.startsWith("image/")) setMediaDisposition("photo");
                        else if (f.type.startsWith("video/")) setMediaDisposition("video");
                        else if (f.type.startsWith("audio/")) setMediaDisposition("audio");
                        else setMediaDisposition("document");
                      }
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => { setMediaUrl(e.target.value); if (mediaFile) setMediaFile(null); }}
                  placeholder="o pega una URL pública..."
                  className="flex-1 h-10 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                />
              </div>
              {(mediaFile || mediaUrl) && (
                <button onClick={() => { setMediaFile(null); setMediaUrl(""); }} className="mt-2 text-xs text-red-400 hover:text-red-500">
                  Quitar adjunto
                </button>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={
                sending ||
                !selectedConfig ||
                (!messageText.trim() && !mediaFile && !mediaUrl.trim()) ||
                (recipientMode === "manual" && !chatId.trim()) ||
                (recipientMode === "client" && !selectedClientId) ||
                (recipientMode === "all" && telegramClients.length === 0)
              }
              className="w-full h-12 bg-[#2AABEE] text-white rounded-xl text-sm font-medium hover:bg-[#1D8FC9] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  Enviar por Telegram
                </>
              )}
            </button>

            {sendResults.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto border border-[#E8E0D8] rounded-xl">
                {sendResults.map((r, i) => (
                  <div key={i} className={`px-3 py-2 text-xs border-b border-[#E8E0D8] last:border-0 flex items-start gap-2 ${r.ok ? "text-[#6B8E6B]" : "text-red-400"}`}>
                    {r.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                    <span>
                      <span className="font-medium text-[#5C3E35]">{r.name}</span>
                      {r.ok ? " enviado" : ` · ${r.error || "no enviado"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Acciones Rápidas</h3>
                <button onClick={openCreateAction} className="flex items-center gap-1.5 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] transition-colors">
                  <Plus size={14} /> Nueva
                </button>
              </div>
              <div className="space-y-2">
                {quickActions.map((action) => {
                  const IconComp = getIconComponent(action.iconName).icon;
                  return (
                    <div key={action.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => executeQuickAction(action)}
                        className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-all text-left"
                      >
                        <div className={`w-10 h-10 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                          <IconComp size={18} className={action.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#5C3E35] truncate">{action.name}</p>
                          <p className="text-xs text-[#9C8A82] truncate">{action.description}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => openEditAction(action)}
                        className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Cómo enviar a un cliente</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#5C3E35]">
                <li>El cliente debe escribirle <span className="font-medium">/start</span> a tu bot en Telegram (los bots no pueden iniciar conversación).</li>
                <li>El bot le responderá con su <span className="font-medium">chat_id</span>.</li>
                <li>Guarda ese chat_id en el formulario del cliente (campo &quot;Telegram Chat ID&quot;).</li>
                <li>Usa ese chat_id aquí para enviarle mensajes o avisos.</li>
              </ol>
              <p className="mt-4 text-xs text-[#9C8A82]">
                Consejo: los mensajes entrantes aparecen en el historial; pulsa el icono de enviar junto a uno para rellenar el chat_id automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TEMPLATES TAB ===================== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateTemplate} className="flex items-center gap-2 bg-[#B8837E] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              <Plus size={18} /> Nueva Plantilla
            </button>
          </div>

          {localTemplates.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Bookmark size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay plantillas creadas</p>
              <p className="text-xs mt-1">Crea plantillas para enviar mensajes predefinidos (aparecen también en WhatsApp y Email)</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localTemplates.map((template) => (
                <div key={template.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#B8837E]/10 flex items-center justify-center">
                        <FileText size={16} className="text-[#B8837E]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#5C3E35]">{template.name}</p>
                        <p className="text-xs text-[#9C8A82]">{template.category}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3 mb-3 line-clamp-3">{template.message}</p>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.variables.map((v) => (
                        <span key={v} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#B8837E]/10 text-[#B8837E]">
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => selectTemplate(template)} className="flex-1 h-9 bg-[#2AABEE] text-white rounded-xl text-xs font-medium hover:bg-[#1D8FC9] transition-all flex items-center justify-center gap-1">
                      <Send size={12} /> Usar
                    </button>
                    <button onClick={() => { setPreviewTemplate(template); setPreviewVars({}); }} className="h-9 w-9 border border-[#E8E0D8] rounded-xl flex items-center justify-center text-[#9C8A82] hover:bg-[#FAF6F0] transition-all">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => openEditTemplate(template)} className="h-9 w-9 border border-[#E8E0D8] rounded-xl flex items-center justify-center text-[#9C8A82] hover:bg-[#FAF6F0] transition-all">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => deleteTemplate(template.id, template.is_system)} className="h-9 w-9 border border-[#E8E0D8] rounded-xl flex items-center justify-center text-[#D4A0A0] hover:bg-red-50 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== QUICK ACTIONS TAB ===================== */}
      {activeTab === "actions" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateAction} className="flex items-center gap-2 bg-[#B8837E] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              <Plus size={18} /> Nueva Acción
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const IconComp = getIconComponent(action.iconName).icon;
              return (
                <div key={action.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center`}>
                      <IconComp size={22} className={action.color} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#5C3E35]">{action.name}</p>
                      <p className="text-xs text-[#9C8A82]">{action.description}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#5C3E35] bg-[#FAF6F0] rounded-xl p-3 mb-3 line-clamp-3">{action.message}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => executeQuickAction(action)} className="flex-1 h-9 bg-[#2AABEE] text-white rounded-xl text-xs font-medium hover:bg-[#1D8FC9] transition-all flex items-center justify-center gap-1">
                      <Send size={12} /> Usar
                    </button>
                    <button onClick={() => openEditAction(action)} className="h-9 w-9 border border-[#E8E0D8] rounded-xl flex items-center justify-center text-[#9C8A82] hover:bg-[#FAF6F0] transition-all">
                      <Edit3 size={14} />
                    </button>
                    {!action.isDefault && (
                      <button onClick={() => deleteAction(action.id)} className="h-9 w-9 border border-[#E8E0D8] rounded-xl flex items-center justify-center text-[#D4A0A0] hover:bg-red-50 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== CONFIGS TAB ===================== */}
      {activeTab === "configs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#5C3E35]">Bots Configurados</h3>
              <button onClick={() => setShowAddConfig(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] transition-colors">
                <Plus size={14} /> Agregar Bot
              </button>
            </div>
            {configs.length === 0 ? (
              <p className="text-sm text-[#9C8A82] text-center py-6">No hay bots de Telegram configurados</p>
            ) : (
              <div className="space-y-2">
                {configs.map((config) => (
                  <div key={config.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-all">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#5C3E35] truncate">{config.label}</p>
                      <p className="text-xs text-[#9C8A82]">{config.is_active ? "Activo" : "Inactivo"}{config.has_token ? " · token configurado" : " · sin token"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {config.owner_chat_id && (
                        <span className="text-xs text-[#9C8A82] px-2 py-1 bg-[#FAF6F0] rounded-lg truncate max-w-[140px]">{config.owner_chat_id}</span>
                      )}
                      <button onClick={() => handleDeleteConfig(config.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8] space-y-3">
            <h3 className="text-sm font-semibold text-[#5C3E35]">Configuración Webhook</h3>
            <p className="text-sm text-[#9C8A82]">
              <span className="font-medium text-[#5C3E35]">URL del Webhook:</span>
            </p>
            <code className="block p-3 bg-[#FAF6F0] rounded-xl text-xs text-[#5C3E35] break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/api/telegram/webhook` : "/api/telegram/webhook"}
            </code>
            <button
              onClick={handleRegisterWebhook}
              disabled={webhookLoading || !selectedConfig}
              className="w-full h-11 bg-[#2AABEE] text-white rounded-xl text-sm font-medium hover:bg-[#1D8FC9] transition-all shadow-sm disabled:opacity-50"
            >
              {webhookLoading ? "Registrando..." : "Registrar Webhook en el Bot"}
            </button>
            <p className="text-xs text-[#9C8A82]">
              Registra la URL para que Telegram envíe aquí los mensajes que reciba el bot. Necesario para ver mensajes entrantes y vincular clientes.
            </p>
          </div>

          {/* Clientes sin Telegram vinculado (tesis de chat_id) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#5C3E35]">Clientes sin Telegram vinculado</h3>
              <span className="text-xs text-[#9C8A82]">
                {allClients.length - telegramClients.length} de {allClients.length}
              </span>
            </div>
            <p className="text-xs text-[#9C8A82] mb-3">
              Pídele a cada cliente que escriba <b>/start</b> a tu bot de Telegram. El sistema detecta su chat_id automáticamente.
            </p>
            {allClients.length - telegramClients.length === 0 ? (
              <p className="text-sm text-[#6B8E6B]">Todos tus clientes ya tienen Telegram configurado.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-[#E8E0D8] rounded-xl">
                {allClients
                  .filter((c) => !c.telegram_chat_id)
                  .slice(0, 50)
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b border-[#E8E0D8] last:border-0">
                      <p className="text-sm text-[#5C3E35] truncate">{c.full_name || "Cliente"}</p>
                      {c.phone && (
                        <button
                          onClick={() => {
                            const m = `Hola ${c.full_name || ""}\nPara seguir recibiendo tus avisos de facturas, pagos y saldos, nuestro bot @${selectedConfig?.label || "AlmaiaBot"} te espera. Abre Telegram y escríbele /start.`
                            navigator.clipboard?.writeText(m);
                            toast.success("Mensaje copiado: pégalo y envíalo por WhatsApp");
                          }}
                          className="text-xs text-[#B8837E] hover:text-[#9A6B66] flex items-center gap-1 shrink-0"
                        >
                          <Copy size={12} /> Copiar invitación
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recordatorio masivo de pagos por Telegram */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
            <h3 className="text-sm font-semibold text-[#5C3E35] mb-1">Recordatorio Masivo de Pagos</h3>
            <p className="text-xs text-[#9C8A82] mb-3">
              Envía el mensaje de arriba a todos los clientes con saldo pendiente y Telegram vinculado. Usa {"{cliente}"} y {"{monto}"} como variables.
            </p>
            <button
              onClick={handleTelegramReminders}
              disabled={reminderSending || !selectedConfig || !messageText.trim()}
              className="w-full h-11 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50"
            >
              {reminderSending ? "Enviando recordatorios..." : "Enviar recordatorios a clientes con saldo"}
            </button>
          </div>
        </div>
      )}

      {/* ===================== LOGS TAB ===================== */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8E0D8]">
            <h3 className="text-sm font-semibold text-[#5C3E35]">Historial de Telegram</h3>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-[#9C8A82]">
              <History size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay mensajes de Telegram</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0D8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Chat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Mensaje</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#E8E0D8] last:border-0 hover:bg-[#FAF6F0]">
                    <td className="px-4 py-3 text-sm text-[#5C3E35] whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      {log.direction === "incoming" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B8837E]">
                          <ArrowDownLeft size={14} /> Entrante
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B8E6B]">
                          <ArrowUpRight size={14} /> Saliente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5C3E35]">{log.chat_id}</td>
                    <td className="px-4 py-3 text-sm text-[#9C8A82] max-w-[220px] truncate" title={log.message_body || ""}>
                      {log.message_body || "(media)"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {log.direction === "outgoing" && (
                          <span title={`Estado: ${log.status}`}>
                            {log.status === "sent" ? (
                              <CheckCheck size={15} className="text-[#6B8E6B]" />
                            ) : log.status === "failed" ? (
                              <AlertCircle size={15} className="text-[#D4A0A0]" />
                            ) : (
                              <Clock size={15} className="text-[#B8837E]" />
                            )}
                          </span>
                        )}
                        {log.direction === "incoming" ? (
                          <ArrowDownLeft size={14} className="text-[#B8837E]" />
                        ) : (
                          <ArrowUpRight size={14} className="text-[#6B8E6B]" />
                        )}
                        <span className="text-sm text-[#5C3E35] capitalize">{log.status}</span>
                        {log.direction === "incoming" && (
                          <button
                            onClick={() => {
                              setChatId(log.chat_id || "");
                              setActiveTab("send");
                              toast.success("Chat ID copiado a Enviar Mensaje");
                            }}
                            className="p-1 rounded-lg text-[#B8837E] hover:bg-[#B8837E]/10 transition-all ml-2"
                            title="Usar este chat para responder"
                          >
                            <Send size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===================== TEMPLATE MODAL ===================== */}
      <Modal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Nombre</label>
            <input
              type="text"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              placeholder="Ej: Bienvenida Cliente"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Categoría</label>
            <select
              value={templateForm.category}
              onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              className={inputCls}
            >
              {templateCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
            <textarea
              value={templateForm.message}
              onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
              placeholder="Escribe el mensaje. Usa {nombre}, {monto}, {fecha} para variables."
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Variables (separadas por coma)</label>
            <input
              type="text"
              value={templateForm.variables}
              onChange={(e) => setTemplateForm({ ...templateForm, variables: e.target.value })}
              placeholder="Ej: nombre, monto, fecha"
              className={inputCls}
            />
            <p className="text-[10px] text-[#9C8A82] mt-1">Usa {"{nombre}"} en el mensaje para insertar la variable</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTemplateModal(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
              Cancelar
            </button>
            <button onClick={saveTemplate} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              {editingTemplate ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================== TEMPLATE PREVIEW MODAL ===================== */}
      <Modal isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} title={`Vista Previa: ${previewTemplate?.name || ""}`}>
        {previewTemplate && (
          <div className="space-y-4">
            <div className="bg-[#E5DDD5] rounded-2xl p-4 relative">
              <div className="bg-white rounded-2xl p-4 shadow-sm max-w-sm ml-auto">
                <p className="text-sm text-[#5C3E35] whitespace-pre-wrap">
                  {(() => {
                    let msg = previewTemplate.message;
                    previewTemplate.variables.forEach((v) => {
                      const val = previewVars[v] || `[${v}]`;
                      msg = msg.replace(new RegExp(`\\{${v}\\}`, "g"), val);
                    });
                    return msg;
                  })()}
                </p>
                <p className="text-[10px] text-[#9C8A82] text-right mt-2">{new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
            {previewTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#9C8A82]">Rellena las variables para previsualizar:</p>
                {previewTemplate.variables.map((v) => (
                  <input
                    key={v}
                    type="text"
                    value={previewVars[v] || ""}
                    onChange={(e) => setPreviewVars({ ...previewVars, [v]: e.target.value })}
                    placeholder={v}
                    className="w-full h-10 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                  />
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { selectTemplate(previewTemplate); setPreviewTemplate(null); }} className="flex-1 h-12 bg-[#2AABEE] text-white rounded-xl text-sm font-medium hover:bg-[#1D8FC9] transition-all shadow-sm flex items-center justify-center gap-2">
                <Send size={16} /> Usar Plantilla
              </button>
              <button onClick={() => { navigator.clipboard.writeText(previewTemplate.message); toast.success("Mensaje copiado"); }} className="h-12 px-4 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center gap-2">
                <Copy size={16} /> Copiar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================== QUICK ACTION MODAL ===================== */}
      <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title={editingAction ? "Editar Acción" : "Nueva Acción Rápida"}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Nombre</label>
            <input
              type="text"
              value={actionForm.name}
              onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })}
              placeholder="Ej: Enviar Catálogo"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Descripción</label>
            <input
              type="text"
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              placeholder="Breve descripción"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Icono</label>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm flex items-center gap-3 hover:bg-[#FAF6F0] transition-all"
            >
              {(() => {
                const iconData = getIconComponent(actionForm.iconName);
                const IconC = iconData.icon;
                return (
                  <>
                    <div className={`w-7 h-7 rounded-lg ${iconData.bgColor} flex items-center justify-center`}>
                      <IconC size={16} className={iconData.color} />
                    </div>
                    <span>{actionForm.iconName}</span>
                    <ChevronDown size={14} className="ml-auto text-[#9C8A82]" />
                  </>
                );
              })()}
            </button>
            {showIconPicker && (
              <div className="mt-2 p-2 bg-white border border-[#E8E0D8] rounded-xl shadow-lg inline-flex flex-wrap gap-1 max-w-[280px]">
                {ICON_OPTIONS.map((opt) => {
                  const Ic = opt.icon;
                  return (
                    <button
                      key={opt.name}
                      title={opt.name}
                      onClick={() => { setActionForm({ ...actionForm, iconName: opt.name }); setShowIconPicker(false); }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${actionForm.iconName === opt.name ? "ring-2 ring-[#B8837E] " + opt.bgColor : "hover:bg-[#FAF6F0]"}`}
                    >
                      <Ic size={15} className={opt.color} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje predeterminado</label>
            <textarea
              value={actionForm.message}
              onChange={(e) => setActionForm({ ...actionForm, message: e.target.value })}
              placeholder="Escribe el mensaje. Usa {cliente}, {monto}, {fecha} para variables."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowActionModal(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">
              Cancelar
            </button>
            <button onClick={saveAction} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              {editingAction ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================== ADD TELEGRAM CONFIG MODAL ===================== */}
      <Modal isOpen={showAddConfig} onClose={() => setShowAddConfig(false)} title="Agregar Bot de Telegram">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Etiqueta</label>
            <input type="text" value={configForm.label} onChange={(e) => setConfigForm({ ...configForm, label: e.target.value })} placeholder="Ej: Bot de Avisos" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Token del Bot</label>
            <input type="password" value={configForm.bot_token} onChange={(e) => setConfigForm({ ...configForm, bot_token: e.target.value })} placeholder="Token de @BotFather, ej: 123456:ABC-DEF..." className={inputCls} />
            <p className="text-[10px] text-[#9C8A82] mt-1">Ve a @BotFather en Telegram, crea un bot y copia su token. Es gratis.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Chat ID del dueño (opcional)</label>
            <input type="text" value={configForm.owner_chat_id} onChange={(e) => setConfigForm({ ...configForm, owner_chat_id: e.target.value })} placeholder="Ej: 123456789" className={inputCls} />
            <p className="text-[10px] text-[#9C8A82] mt-1">Para recibir avisos automáticos (Modelo A). Escríbele /start al bot para obtener tu chat_id.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddConfig(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleAddConfig} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">Guardar</button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}