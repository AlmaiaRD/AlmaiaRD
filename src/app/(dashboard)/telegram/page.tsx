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
import { getClients } from "@/services/clients";
import type { Client } from "@/types/database";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type Tab = "send" | "configs" | "logs";

export default function TelegramPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<TelegramConfig[]>([]);
  const [logs, setLogs] = useState<TelegramLogRow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("send");
  const [selectedConfig, setSelectedConfig] = useState<TelegramConfig | null>(null);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ label: "", bot_token: "", owner_chat_id: "" });
  const [chatId, setChatId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [recipientMode, setRecipientMode] = useState<"manual" | "client" | "all">("manual");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [telegramClients, setTelegramClients] = useState<Client[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [configsData, logsData, clientsData] = await Promise.all([getTelegramConfigs(), getTelegramLogs(), getClients()]);
        setConfigs(configsData);
        setLogs(logsData);
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
      setConfigForm({ label: "", bot_token: "", owner_chat_id: "" });
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
    if (!messageText.trim()) {
      toast.error("Ingresa un mensaje");
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

    setSending(true);
    try {
      let sent = 0;
      let failed = 0;
      for (const target of targets) {
        const result = await sendViaTelegramApi(selectedConfig.id, target.chatId, text);
        if (result.success) sent++;
        else failed++;
      }
      if (sent > 0) toast.success(`Enviado a ${sent} destinatario(s) por Telegram`);
      if (failed > 0) toast.error(`${failed} destinatario(s) no se pudieron enviar`);
      setMessageText("");
      setLogs(await getTelegramLogs());
    } catch {
      toast.error("Error al enviar mensaje de Telegram");
    } finally {
      setSending(false);
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
            </div>
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !selectedConfig ||
                !messageText.trim() ||
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