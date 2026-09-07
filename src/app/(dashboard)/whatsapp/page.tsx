"use client";

import { useState, useEffect, useMemo } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { normalize } from "@/lib/search";
import {
  getWhatsAppConfigs,
  createWhatsAppConfig,
  deleteWhatsAppConfig,
  sendViaApi,
  logWhatsAppMessage,
  getWhatsAppLogs,
  type WhatsAppConfig,
  type WhatsAppLogRow as ServiceWhatsAppLogRow,
} from "@/services/whatsapp";
import { getClients } from "@/services/clients";
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
  getTelegramConfigs,
  createTelegramConfig,
  deleteTelegramConfig,
  sendViaTelegramApi,
  getTelegramLogs,
  registerTelegramWebhook,
  type TelegramConfig,
  type TelegramLogRow,
} from "@/services/telegram";

interface WhatsAppLogRow extends ServiceWhatsAppLogRow {
  direction?: string | null;
  recipient?: string | null;
  message_body?: string | null;
  template_name?: string | null;
  message_type?: string | null;
  status_updated_at?: string | null;
}
import { formatDate } from "@/lib/utils";
import {
  MessageCircle,
  Plus,
  Trash2,
  Send,
  Settings,
  History,
  Phone,
  Search,
  CheckCircle,
  CheckCheck,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Bookmark,
  Edit3,
  Eye,
  Copy,
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
  Users,
  Zap,
  ChevronDown,
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
    description: "Envía una factura por WhatsApp",
    iconName: "FileText",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    message: "Hola {cliente}, te envío la factura #{numero} por un total de RD${monto}. Fecha de vencimiento: {fecha}. ¡Gracias por tu compra!",
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
    message: "Hola {cliente}, te recordamos que tienes un saldo pendiente de RD${monto}. Fecha de vencimiento: {fecha}. Si ya realizaste el pago, ignora este mensaje.",
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
    message: "¡Bienvenido/a a Almaia RD! {cliente}, somos distribuidores autorizados Amway. Estamos aquí para ofrecerte productos de calidad para tu bienestar y salud. ¿En qué podemos ayudarte?",
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
    message: "¡Hola {cliente}! 🌟 Tenemos una promoción especial para ti: {detalle}. ¡No te lo pierdas! Escríbenos para más información.",
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

const TEMPLATES_LEGACY_STORAGE_KEY = "almaia_whatsapp_templates";
const QUICK_ACTIONS_STORAGE_KEY = "almaia_whatsapp_quick_actions";

const STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
  received: "Recibido",
  processing: "Procesando",
  pending: "Pendiente",
};

export default function WhatsAppPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<WhatsAppLogRow[]>([]);
  const [activeTab, setActiveTab] = useState<"send" | "templates" | "actions" | "configs" | "logs" | "telegram">("send");
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<WhatsAppConfig | null>(null);

  // Telegram
  const [telegramConfigs, setTelegramConfigs] = useState<TelegramConfig[]>([]);
  const [telegramLogs, setTelegramLogs] = useState<TelegramLogRow[]>([]);
  const [telegramSelectedConfig, setTelegramSelectedConfig] = useState<TelegramConfig | null>(null);
  const [showAddTelegramConfig, setShowAddTelegramConfig] = useState(false);
  const [telegramConfigForm, setTelegramConfigForm] = useState({ label: "", bot_token: "", owner_chat_id: "" });
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramMessageText, setTelegramMessageText] = useState("");
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramWebhookLoading, setTelegramWebhookLoading] = useState(false);

  // Send form
  const [recipientPhone, setRecipientPhone] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedLocalTemplate, setSelectedLocalTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const [searchClient, setSearchClient] = useState("");

  // Local templates
  const [localTemplates, setLocalTemplates] = useState<CommunicationTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", message: "", category: "General", variables: "" });
  const [previewTemplate, setPreviewTemplate] = useState<CommunicationTemplate | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  // Quick actions
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const [actionForm, setActionForm] = useState({ name: "", description: "", iconName: "Send", message: "", type: "text" as "text" | "template" });
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Config form
  const [configForm, setConfigForm] = useState({
    label: "",
    phone_number_id: "",
    access_token: "",
    verify_token: "",
    business_account_id: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
    loadLocalData();
    loadTemplates();
  }, []);

  function loadLocalData() {
    try {
      const storedActions = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
      if (storedActions) {
        setQuickActions(JSON.parse(storedActions));
      } else {
        setQuickActions(DEFAULT_QUICK_ACTIONS);
        localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_QUICK_ACTIONS));
      }
    } catch { toast.error("Error al cargar datos locales"); }
  }

  // Unificar plantillas: se leen desde BD (communication_templates). Si la BD
  // aún no tiene ninguna y existían plantillas en localStorage (versión legacy),
  // se migran automáticamente y se limpia la clave antigua.
  async function loadTemplates() {
    try {
      let dbTemplates = await getTemplates("whatsapp");
      const legacyRaw = localStorage.getItem(TEMPLATES_LEGACY_STORAGE_KEY);
      if (dbTemplates.length === 0 && legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as { name: string; message: string; category: string; variables: string[] }[];
        const migrated: CommunicationTemplate[] = [];
        for (const t of legacy) {
          if (!t.name || !t.message) continue;
          migrated.push(await createTemplate({ channel: "whatsapp", name: t.name, message: t.message, variables: t.variables || [], category: t.category || "General" }));
        }
        if (migrated.length > 0) {
          localStorage.removeItem(TEMPLATES_LEGACY_STORAGE_KEY);
        }
        dbTemplates = migrated;
      }
      setLocalTemplates(dbTemplates);
    } catch {
      toast.error("Error al cargar plantillas");
    }
  }

  function saveQuickActions(actions: QuickAction[]) {
    setQuickActions(actions);
    localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(actions));
  }

  async function loadData() {
    try {
      const [configsData, clientsData, logsData, telegramConfigsData, telegramLogsData] = await Promise.all([
        getWhatsAppConfigs(),
        getClients(),
        getWhatsAppLogs(),
        getTelegramConfigs(),
        getTelegramLogs(),
      ]);
      setConfigs(configsData);
      setClients(clientsData);
      setLogs(logsData);
      setTelegramConfigs(telegramConfigsData);
      setTelegramLogs(telegramLogsData);
      if (configsData.length > 0) {
        setSelectedConfig(configsData.find((c) => c.is_active) || configsData[0]);
      }
      if (telegramConfigsData.length > 0) {
        setTelegramSelectedConfig(telegramConfigsData.find((c) => c.is_active) || telegramConfigsData[0]);
      }
    } catch {
      toast.error("Error al cargar datos");
    }
  }

  // ---- Telegram ----
  async function handleAddTelegramConfig() {
    if (!telegramConfigForm.label.trim() || !telegramConfigForm.bot_token.trim()) {
      toast.error("Completa la etiqueta y el token del bot");
      return;
    }
    try {
      const newConfig = await createTelegramConfig({
        label: telegramConfigForm.label.trim(),
        bot_token: telegramConfigForm.bot_token.trim(),
        owner_chat_id: telegramConfigForm.owner_chat_id.trim() || null,
      });
      setTelegramConfigs((prev) => [...prev, newConfig]);
      setShowAddTelegramConfig(false);
      setTelegramConfigForm({ label: "", bot_token: "", owner_chat_id: "" });
      toast.success("Bot de Telegram agregado");
    } catch {
      toast.error("Error al guardar el bot de Telegram");
    }
  }

  async function handleDeleteTelegramConfig(id: string) {
    try {
      await deleteTelegramConfig(id);
      setTelegramConfigs((prev) => prev.filter((c) => c.id !== id));
      if (telegramSelectedConfig?.id === id) setTelegramSelectedConfig(telegramConfigs[0] || null);
      toast.success("Bot de Telegram eliminado");
    } catch {
      toast.error("Error al eliminar el bot de Telegram");
    }
  }

  async function handleTelegramSend() {
    if (!telegramSelectedConfig) {
      toast.error("Selecciona un bot de Telegram");
      return;
    }
    if (!telegramChatId.trim()) {
      toast.error("Ingresa un chat_id de Telegram");
      return;
    }
    if (!telegramMessageText.trim()) {
      toast.error("Ingresa un mensaje");
      return;
    }

    setTelegramSending(true);
    try {
      const result = await sendViaTelegramApi(telegramSelectedConfig.id, telegramChatId.trim(), telegramMessageText);
      if (result.success) {
        toast.success("Mensaje enviado por Telegram");
        setTelegramMessageText("");
        // El log lo registra la ruta /api/telegram/send; solo recargamos.
        setTelegramLogs(await getTelegramLogs());
      } else {
        toast.error(result.error || "Error al enviar mensaje de Telegram");
      }
    } catch {
      toast.error("Error al enviar mensaje de Telegram");
    } finally {
      setTelegramSending(false);
    }
  }

  async function handleRegisterTelegramWebhook() {
    if (!telegramSelectedConfig) {
      toast.error("Selecciona un bot de Telegram");
      return;
    }
    setTelegramWebhookLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await registerTelegramWebhook(telegramSelectedConfig.id, `${origin}/api/telegram/webhook`);
      if (result.success) {
        toast.success("Webhook registrado correctamente");
      } else {
        toast.error(result.error || "Error al registrar el webhook");
      }
    } catch {
      toast.error("Error al registrar el webhook");
    } finally {
      setTelegramWebhookLoading(false);
    }
  }

  // ---- Template CRUD (BD unificada) ----
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
          channel: "whatsapp",
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
    setSelectedLocalTemplate(template.id);
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
    // Replace variable placeholders with empty brackets
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

  // ---- Send ----
  async function handleSend() {
    if (!selectedConfig) {
      toast.error("Selecciona una configuración de WhatsApp");
      return;
    }
    if (!recipientPhone) {
      toast.error("Ingresa un número de teléfono");
      return;
    }
    if (!messageText.trim()) {
      toast.error("Ingresa un mensaje");
      return;
    }

    setSending(true);
    try {
      const result = await sendViaApi(
        selectedConfig.id,
        recipientPhone,
        "text",
        { text: messageText }
      );

      if (result.success) {
        toast.success("Mensaje enviado correctamente");
        setMessageText("");
        setSelectedLocalTemplate("");
        logWhatsAppMessage(selectedConfig.id, recipientPhone, "text", undefined, "sent", result.messageId).catch(() => {});
        loadData();
      } else {
        toast.error(result.error || "Error al enviar mensaje");
        logWhatsAppMessage(selectedConfig.id, recipientPhone, "text", undefined, "failed", undefined, result.error).catch(() => {});
      }
    } catch {
      toast.error("Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  }

  // ---- Config CRUD ----
  async function handleAddConfig() {
    if (!configForm.label || !configForm.phone_number_id || !configForm.access_token) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    try {
      const newConfig = await createWhatsAppConfig(configForm);
      setConfigs([...configs, newConfig]);
      setShowAddConfig(false);
      setConfigForm({ label: "", phone_number_id: "", access_token: "", verify_token: "", business_account_id: "", is_active: true });
      toast.success("Configuración agregada");
    } catch {
      toast.error("Error al guardar configuración");
    }
  }

  async function handleDeleteConfig(id: string) {
    try {
      await deleteWhatsAppConfig(id);
      setConfigs(configs.filter((c) => c.id !== id));
      if (selectedConfig?.id === id) setSelectedConfig(configs[0] || null);
      toast.success("Configuración eliminada");
    } catch {
      toast.error("Error al eliminar configuración");
    }
  }

  function selectClient(client: Client) {
    setRecipientPhone(client.phone || "");
    setSearchClient("");
  }

  const filteredClients = clients.filter(
    (c) => normalize(c.full_name || "").includes(normalize(searchClient)) || normalize(c.phone || "").includes(normalize(searchClient))
  );

  const templateCategories = useMemo(() => {
    const cats = new Set(localTemplates.map((t) => t.category));
    return ["General", ...Array.from(cats)];
  }, [localTemplates]);

  return (
    <PageContainer>
      <div className="mb-8">
        <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-[#9C8A82] hover:text-[#5C3E35] mb-3 transition-colors">
          <ArrowLeft size={16} /> Volver a CRM
        </button>
        <h1 className="text-2xl font-bold text-[#5C3E35]">WhatsApp Business</h1>
        <p className="text-sm text-[#9C8A82] mt-1">Envía mensajes, plantillas y recordatorios por WhatsApp</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E8E0D8] pb-2 flex-wrap">
        {[
          { key: "send", label: "Enviar Mensaje", icon: Send },
          { key: "templates", label: "Plantillas", icon: Bookmark },
          { key: "actions", label: "Acciones Rápidas", icon: Zap },
          { key: "configs", label: "Configuraciones", icon: Settings },
          { key: "logs", label: "Historial", icon: History },
          { key: "telegram", label: "Telegram", icon: Send },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as "send" | "templates" | "actions" | "configs" | "logs" | "telegram");
            }}
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
            <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Enviar Mensaje</h3>

            {/* Select Config */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Cuenta de WhatsApp</label>
              <select
                value={selectedConfig?.id || ""}
                onChange={(e) => {
                  const config = configs.find((c) => c.id === e.target.value);
                  setSelectedConfig(config || null);
                }}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              >
                <option value="">Seleccionar cuenta...</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.label} ({config.phone_number_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Client Search */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Buscar Cliente</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                <input
                  type="text"
                  value={searchClient}
                  onChange={(e) => setSearchClient(e.target.value)}
                  placeholder="Nombre o teléfono..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                />
              </div>
              {searchClient && filteredClients.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto border border-[#E8E0D8] rounded-xl bg-white">
                  {filteredClients.slice(0, 5).map((client) => (
                    <button
                      key={client.id}
                      onClick={() => selectClient(client)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAF6F0] flex items-center gap-2"
                    >
                      <Phone size={14} className="text-[#9C8A82]" />
                      <span className="text-[#5C3E35]">{client.full_name}</span>
                      <span className="text-xs text-[#9C8A82]">{client.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Teléfono</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Ej: 8091234567"
                className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              />
            </div>

            {/* Template selector */}
            {localTemplates.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Plantilla rápida</label>
                <select
                  value={selectedLocalTemplate}
                  onChange={(e) => {
                    const tpl = localTemplates.find((t) => t.id === e.target.value);
                    if (tpl) {
                      setSelectedLocalTemplate(tpl.id);
                      let msg = tpl.message;
                      tpl.variables.forEach((v) => { msg = msg.replace(`{${v}}`, `[${v}]`); });
                      setMessageText(msg);
                    } else {
                      setSelectedLocalTemplate("");
                    }
                  }}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Escribir mensaje manualmente...</option>
                  {localTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name} — {tpl.category}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Message */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
              />
              {messageText && (
                <p className="text-xs text-[#9C8A82] mt-1">{messageText.length} caracteres</p>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !selectedConfig || !recipientPhone || !messageText.trim()}
              className="w-full h-12 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#128C7E] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <MessageCircle size={18} />
                  Enviar por WhatsApp
                </>
              )}
            </button>
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

            {/* Webhook Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Configuración Webhook</h3>
              <div className="space-y-2 text-sm">
                <p className="text-[#9C8A82]">
                  <span className="font-medium text-[#5C3E35]">URL del Webhook:</span>
                </p>
                <code className="block p-3 bg-[#FAF6F0] rounded-xl text-xs text-[#5C3E35] break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook"}
                </code>
              </div>
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
              <p className="text-xs mt-1">Crea plantillas para enviar mensajes predefinidos</p>
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
                    <button onClick={() => selectTemplate(template)} className="flex-1 h-9 bg-[#25D366] text-white rounded-xl text-xs font-medium hover:bg-[#128C7E] transition-all flex items-center justify-center gap-1">
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
                    <button onClick={() => executeQuickAction(action)} className="flex-1 h-9 bg-[#25D366] text-white rounded-xl text-xs font-medium hover:bg-[#128C7E] transition-all flex items-center justify-center gap-1">
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddConfig(true)} className="flex items-center gap-2 bg-[#B8837E] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">
              <Plus size={18} /> Agregar Cuenta
            </button>
          </div>
          {configs.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <MessageCircle size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay cuentas de WhatsApp configuradas</p>
            </div>
          ) : (
            configs.map((config) => (
              <div key={config.id} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${selectedConfig?.id === config.id ? "border-[#B8837E] ring-2 ring-[#B8837E]/20" : "border-[#E8E0D8]"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                      <MessageCircle size={24} className="text-[#25D366]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#5C3E35]">{config.label}</p>
                      <p className="text-sm text-[#9C8A82]">ID: {config.phone_number_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {config.is_active ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>}
                    <button onClick={() => setSelectedConfig(config)} className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all">
                      <Settings size={16} />
                    </button>
                    <button onClick={() => handleDeleteConfig(config.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== LOGS TAB ===================== */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <History size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay mensajes en el historial</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0D8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase">Teléfono</th>
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
                    <td className="px-4 py-3 text-sm text-[#5C3E35]">{log.recipient || log.to}</td>
                    <td className="px-4 py-3 text-sm text-[#9C8A82] max-w-[320px] truncate" title={log.message_body || log.template_name || ""}>
                      {log.message_body || (log.direction === "incoming" ? "(adjunto o media)" : log.message_type)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {log.status === "sent" ? <CheckCircle size={14} className="text-green-500" /> : log.status === "delivered" ? <CheckCheck size={14} className="text-[#B8837E]" /> : log.status === "read" ? <CheckCircle size={14} className="text-blue-500" /> : log.status === "failed" ? <AlertCircle size={14} className="text-red-500" /> : log.status === "received" ? <ArrowDownLeft size={14} className="text-[#6B8E6B]" /> : <Clock size={14} className="text-gray-400" />}
                        <span className="text-sm text-[#5C3E35]">{STATUS_LABELS[log.status || ""] || log.status}</span>
                        {log.status === "delivered" && <span className="text-[10px] text-[#9C8A82]">· a las {new Date(log.status_updated_at || log.created_at || "").toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===================== TELEGRAM TAB ===================== */}
      {activeTab === "telegram" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Enviar mensaje */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Enviar Mensaje por Telegram</h3>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Bot de Telegram</label>
                <select
                  value={telegramSelectedConfig?.id || ""}
                  onChange={(e) => {
                    const config = telegramConfigs.find((c) => c.id === e.target.value);
                    setTelegramSelectedConfig(config || null);
                  }}
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Seleccionar bot...</option>
                  {telegramConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.label} {config.is_active ? "(activo)" : "(inactivo)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Chat ID del destinatario</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Ej: 123456789 (consulta tu chat_id con /start)"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
                <textarea
                  value={telegramMessageText}
                  onChange={(e) => setTelegramMessageText(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
                />
              </div>
              <button
                onClick={handleTelegramSend}
                disabled={telegramSending || !telegramSelectedConfig || !telegramChatId.trim() || !telegramMessageText.trim()}
                className="w-full h-12 bg-[#2AABEE] text-white rounded-xl text-sm font-medium hover:bg-[#1D8FC9] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {telegramSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    Enviar por Telegram
                  </>
                )}
              </button>
            </div>

            {/* Configuración del webhook */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <h3 className="text-sm font-semibold text-[#5C3E35] mb-4">Configuración Webhook</h3>
              <div className="space-y-2 text-sm">
                <p className="text-[#9C8A82]">
                  <span className="font-medium text-[#5C3E35]">URL del Webhook:</span>
                </p>
                <code className="block p-3 bg-[#FAF6F0] rounded-xl text-xs text-[#5C3E35] break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/telegram/webhook` : "/api/telegram/webhook"}
                </code>
                <button
                  onClick={handleRegisterTelegramWebhook}
                  disabled={telegramWebhookLoading || !telegramSelectedConfig}
                  className="mt-2 w-full h-11 bg-[#2AABEE] text-white rounded-xl text-sm font-medium hover:bg-[#1D8FC9] transition-all shadow-sm disabled:opacity-50"
                >
                  {telegramWebhookLoading ? "Registrando..." : "Registrar Webhook en el Bot"}
                </button>
                <p className="text-xs text-[#9C8A82]">
                  Registra la URL para que Telegram envíe aquí los mensajes que reciba el bot. Necesario para ver mensajes entrantes y vincular clientes.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Bots configurados */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Bots Configurados</h3>
                <button onClick={() => setShowAddTelegramConfig(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#B8837E] hover:text-[#9A6B66] transition-colors">
                  <Plus size={14} /> Agregar Bot
                </button>
              </div>
              {telegramConfigs.length === 0 ? (
                <p className="text-sm text-[#9C8A82] text-center py-6">No hay bots de Telegram configurados</p>
              ) : (
                <div className="space-y-2">
                  {telegramConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E8E0D8] hover:bg-[#FAF6F0] transition-all">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#5C3E35] truncate">{config.label}</p>
                        <p className="text-xs text-[#9C8A82]">{config.is_active ? "Activo" : "Inactivo"}{config.has_token ? " · token configurado" : " · sin token"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {config.owner_chat_id && (
                          <span className="text-xs text-[#9C8A82] px-2 py-1 bg-[#FAF6F0] rounded-lg truncate max-w-[140px]">{config.owner_chat_id}</span>
                        )}
                        <button onClick={() => handleDeleteTelegramConfig(config.id)} className="p-2 text-[#D4A0A0] hover:bg-[#D4A0A0]/10 rounded-lg transition-all">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E8E0D8]">
                <h3 className="text-sm font-semibold text-[#5C3E35]">Historial de Telegram</h3>
              </div>
              {telegramLogs.length === 0 ? (
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
                    {telegramLogs.map((log) => (
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
                            <span className="text-sm text-[#5C3E35] capitalize">{log.status}</span>
                            {log.direction === "incoming" && (
                              <button
                                onClick={() => {
                                  setTelegramChatId(log.chat_id || "");
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
          </div>
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
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Categoría</label>
            <select
              value={templateForm.category}
              onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
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
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
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
              <button onClick={() => { selectTemplate(previewTemplate); setPreviewTemplate(null); }} className="flex-1 h-12 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#128C7E] transition-all shadow-sm flex items-center justify-center gap-2">
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
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Descripción</label>
            <input
              type="text"
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              placeholder="Breve descripción"
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
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

      {/* ===================== ADD CONFIG MODAL ===================== */}
      <Modal isOpen={showAddConfig} onClose={() => setShowAddConfig(false)} title="Agregar Cuenta de WhatsApp">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Etiqueta</label>
            <input type="text" value={configForm.label} onChange={(e) => setConfigForm({ ...configForm, label: e.target.value })} placeholder="Ej: WhatsApp Principal" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Phone Number ID</label>
            <input type="text" value={configForm.phone_number_id} onChange={(e) => setConfigForm({ ...configForm, phone_number_id: e.target.value })} placeholder="ID del número de teléfono desde Meta" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Access Token</label>
            <input type="password" value={configForm.access_token} onChange={(e) => setConfigForm({ ...configForm, access_token: e.target.value })} placeholder="Token de acceso permanente" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Verify Token</label>
            <input type="text" value={configForm.verify_token} onChange={(e) => setConfigForm({ ...configForm, verify_token: e.target.value })} placeholder="Token de verificación del webhook" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Business Account ID</label>
            <input type="text" value={configForm.business_account_id} onChange={(e) => setConfigForm({ ...configForm, business_account_id: e.target.value })} placeholder="ID de la cuenta de WhatsApp Business" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddConfig(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleAddConfig} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">Guardar</button>
          </div>
        </div>
      </Modal>
    {/* ===================== ADD TELEGRAM CONFIG MODAL ===================== */}
      <Modal isOpen={showAddTelegramConfig} onClose={() => setShowAddTelegramConfig(false)} title="Agregar Bot de Telegram">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Etiqueta</label>
            <input type="text" value={telegramConfigForm.label} onChange={(e) => setTelegramConfigForm({ ...telegramConfigForm, label: e.target.value })} placeholder="Ej: Bot de Avisos" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Token del Bot</label>
            <input type="password" value={telegramConfigForm.bot_token} onChange={(e) => setTelegramConfigForm({ ...telegramConfigForm, bot_token: e.target.value })} placeholder="Token de @BotFather, ej: 123456:ABC-DEF..." className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            <p className="text-[10px] text-[#9C8A82] mt-1">Ve a @BotFather en Telegram, crea un bot y copia su token. Es gratis.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Chat ID del dueño (opcional)</label>
            <input type="text" value={telegramConfigForm.owner_chat_id} onChange={(e) => setTelegramConfigForm({ ...telegramConfigForm, owner_chat_id: e.target.value })} placeholder="Ej: 123456789" className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            <p className="text-[10px] text-[#9C8A82] mt-1">Para recibir avisos automáticos (Modelo A). Escríbele /start al bot para obtener tu chat_id.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddTelegramConfig(false)} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handleAddTelegramConfig} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm">Guardar</button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
