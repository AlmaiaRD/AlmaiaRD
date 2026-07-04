"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { Send, User, FileText, Briefcase, Gift, Sparkles, ChevronDown, Plus, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { createCommunication } from "@/services/communications";
import { getClients } from "@/services/clients";
import { getInvoices } from "@/services/invoices";
import { getProducts } from "@/services/products";
import toast from "react-hot-toast";
import type { Client, Product } from "@/types/database";

type MessageType = "contacto_inicial" | "seguimiento_compra" | "prospecto_negocio" | "cumpleanos" | "personalizado";

interface MessageTemplate {
  id: MessageType;
  label: string;
  icon: any;
  description: string;
  subject?: string;
  body: string;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;
  label: string;
  type: "client" | "invoice" | "product" | "text" | "number" | "date" | "textarea";
  placeholder?: string;
  required?: boolean;
  autoFillKey?: string;
}

const MESSAGE_TYPES: MessageTemplate[] = [
  {
    id: "contacto_inicial",
    label: "Contacto Inicial",
    icon: User,
    description: "Primer contacto con un cliente",
    subject: "¡Hola {{nombre_cliente}}! Bienvenido/a a {{empresa}}",
    body: `Hola {{nombre_cliente}},

¡Bienvenido/a a {{empresa}}! 🌟

Mi nombre es {{nombre_vendedor}} y estoy aquí para ayudarte a descubrir todos los beneficios que tenemos para ti.

¿Te gustaría conocer nuestros productos y promociones actuales? Estoy a tu disposición para cualquier pregunta.

¡Espero poder atenderte pronto!

Saludos,
{{nombre_vendedor}}`,
    fields: [
      { key: "nombre_cliente", label: "Cliente", type: "client", autoFillKey: "full_name" },
      { key: "nombre_vendedor", label: "Tu Nombre", type: "text", placeholder: "Ej: Yrahisa Mateo, Almaia RD" },
      { key: "empresa", label: "Empresa", type: "text", placeholder: "Ej: Almaia RD" },
    ],
  },
  {
    id: "seguimiento_compra",
    label: "Seguimiento de Compra",
    icon: FileText,
    description: "Seguimiento post-venta a compradores",
    subject: "Factura {{numero_factura}} – Seguimiento de tu compra",
    body: `Hola {{nombre_cliente}},

¡Gracias por tu compra reciente! 🛒

Tu factura {{numero_factura}} por un total de {{monto_total}} ha sido registrada exitosamente.

Productos adquiridos:
{{lista_productos}}

¿Cómo te han ido con los productos? Si tienes alguna duda o necesitas recomprar, estoy aquí para ayudarte.

¿Te gustaría que te recuerde cuando sea momento de reabastecer?

Saludos,
{{nombre_vendedor}}`,
    fields: [
      { key: "nombre_cliente", label: "Cliente", type: "client", autoFillKey: "full_name" },
      { key: "numero_factura", label: "Factura", type: "invoice", autoFillKey: "invoice_number" },
      { key: "monto_total", label: "Monto Total", type: "text", autoFillKey: "total" },
      { key: "lista_productos", label: "Productos", type: "product", autoFillKey: "products" },
      { key: "nombre_vendedor", label: "Tu Nombre", type: "text", placeholder: "Ej: Yrahisa Mateo, Almaia RD" },
    ],
  },
  {
    id: "prospecto_negocio",
    label: "Prospecto de Negocio",
    icon: Briefcase,
    description: "Primer contacto con prospectos IBO",
    subject: "Oportunidad de negocio con {{empresa}}",
    body: `Hola {{nombre_prospecto}},

¿Qué tal? Mi nombre es {{nombre_vendedor}} y me comunico contigo porque creo que podrías estar interesado/a en una oportunidad de negocio.

{{empresa}} está buscando personas emprendedoras como tú para unirse a nuestro equipo de Distribuidores Independientes.

✅ Flexibilidad de horarios
✅ Ingresos adicionales
✅ Productos de alta calidad
✅ Apoyo y capacitación continua

¿Te gustaría que te cuente más sobre esta oportunidad? Podemos reunirnos a conveniencia para conversar.

¡Espero tu respuesta!

Saludos,
{{nombre_vendedor}}`,
    fields: [
      { key: "nombre_prospecto", label: "Nombre del Prospecto", type: "text", placeholder: "Ej: Carlos López" },
      { key: "nombre_vendedor", label: "Tu Nombre", type: "text", placeholder: "Ej: Yrahisa Mateo, Almaia RD" },
      { key: "empresa", label: "Empresa", type: "text", placeholder: "Ej: Almaia RD" },
      { key: "interes", label: "Interés Principal", type: "text", placeholder: "Ej: Ingresos adicionales, Productos de salud" },
    ],
  },
  {
    id: "cumpleanos",
    label: "Cumpleaños",
    icon: Gift,
    description: "Mensaje especial de cumpleaños",
    subject: "¡Feliz cumpleaños {{nombre_cliente}}! 🎂",
    body: `¡Feliz cumpleaños {{nombre_cliente}}! 🎂🎉

En este día tan especial, {{empresa}} desea celebrar contigo.

Como regalo, tenemos una oferta especial solo para ti:
🎁 {{oferta_especial}}

¡Esperamos que tengas un día maravilloso lleno de alegría y éxitos!

Con cariño,
{{nombre_vendedor}}
{{empresa}}`,
    fields: [
      { key: "nombre_cliente", label: "Cliente", type: "client", autoFillKey: "full_name" },
      { key: "nombre_vendedor", label: "Tu Nombre", type: "text", placeholder: "Ej: Yrahisa Mateo, Almaia RD" },
      { key: "empresa", label: "Empresa", type: "text", placeholder: "Ej: Almaia RD" },
      { key: "oferta_especial", label: "Oferta Especial", type: "text", placeholder: "Ej: 15% de descuento en tu próxima compra" },
    ],
  },
  {
    id: "personalizado",
    label: "Personalizado",
    icon: Sparkles,
    description: "Escribe tu mensaje desde cero",
    subject: "",
    body: "",
    fields: [
      { key: "nombre_vendedor", label: "Tu Nombre", type: "text", placeholder: "Ej: Yrahisa Mateo, Almaia RD" },
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultType?: MessageType;
  defaultClient?: { id: string; full_name: string; email?: string; phone?: string };
}

const DEFAULT_SENDER = "Yrahisa Mateo, Almaia RD";

export default function MessageComposer({ isOpen, onClose, onSaved, defaultType, defaultClient }: Props) {
  const router = useRouter();
  const [messageType, setMessageType] = useState<MessageType>(defaultType || "contacto_inicial");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClient?.id || "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [showInvoice, setShowInvoice] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const currentTemplate = MESSAGE_TYPES.find(t => t.id === messageType) || MESSAGE_TYPES[0];

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([getClients(), getInvoices(), getProducts()]).then(([c, i, p]) => {
      setClients(c);
      setInvoices(i);
      setProducts(p);
    }).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (defaultClient?.id) {
      setSelectedClientId(defaultClient.id);
    }
  }, [defaultClient]);

  const clientInvoices = useMemo(() => {
    if (!selectedClientId) return [];
    return invoices.filter((inv: any) => inv.client_id === selectedClientId && inv.status !== "CANCELLED");
  }, [selectedClientId, invoices]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find((inv: any) => inv.id === selectedInvoiceId) || null;
  }, [selectedInvoiceId, invoices]);

  const invoiceProducts = useMemo(() => {
    if (!selectedInvoice?.invoice_items) return [];
    return selectedInvoice.invoice_items.map((item: any) => ({
      name: item.products?.name || item.custom_name || "Producto",
      quantity: item.quantity,
      price: item.unit_price,
    }));
  }, [selectedInvoice]);

  useEffect(() => {
    const values: Record<string, string> = {};

    if (defaultClient) {
      if (currentTemplate.fields.some(f => f.autoFillKey === "full_name")) {
        values.nombre_cliente = defaultClient.full_name;
      }
    }

    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        values.nombre_cliente = client.full_name;
      }
    }

    if (selectedInvoiceId && selectedInvoice) {
      values.numero_factura = selectedInvoice.invoice_number;
      values.monto_total = `RD$${Number(selectedInvoice.total).toLocaleString()}`;
      if (showInvoice && invoiceProducts.length > 0) {
        values.lista_productos = invoiceProducts.map((p: any) => `• ${p.name} x${p.quantity}`).join("\n");
      }
    }

    if (!values.nombre_vendedor) {
      values.nombre_vendedor = DEFAULT_SENDER;
    } else {
      values.nombre_vendedor = fieldValues.nombre_vendedor || DEFAULT_SENDER;
    }

    setFieldValues(prev => ({ ...values, ...prev }));
  }, [selectedClientId, selectedInvoiceId, clients, currentTemplate, showInvoice, invoiceProducts]);

  useEffect(() => {
    if (currentTemplate.subject) {
      let filledSubject = currentTemplate.subject;
      Object.entries(fieldValues).forEach(([key, value]) => {
        filledSubject = filledSubject.replace(new RegExp(`{{${key}}}`, "g"), value || `{{${key}}}`);
      });
      setSubject(filledSubject);
    } else {
      setSubject("");
    }

    if (currentTemplate.body) {
      let filledBody = currentTemplate.body;
      Object.entries(fieldValues).forEach(([key, value]) => {
        filledBody = filledBody.replace(new RegExp(`{{${key}}}`, "g"), value || `{{${key}}}`);
      });
      setBody(filledBody);
    } else {
      setBody("");
    }
  }, [fieldValues, currentTemplate]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClientSelect = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedInvoiceId("");
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFieldValues(prev => ({
        ...prev,
        nombre_cliente: client.full_name,
      }));
    }
  }, [clients]);

  async function handleSave(status: "draft" | "sent" = "draft") {
    if (messageType !== "personalizado" && !fieldValues.nombre_cliente && !fieldValues.nombre_prospecto) {
      toast.error("Por favor ingresa el nombre del cliente o prospecto");
      return;
    }

    setSaving(true);
    try {
      const clientId = selectedClientId || defaultClient?.id;
      const commStatus = status;
      const comm = await createCommunication({
        client_id: clientId || undefined,
        type: channel,
        subject: channel === "email" ? subject : undefined,
        body,
        document_type: selectedInvoiceId ? "invoice" : undefined,
        document_id: selectedInvoiceId || undefined,
        status: commStatus,
        sent_at: commStatus === "sent" ? new Date().toISOString() : undefined,
      });

      if (status === "sent") {
        toast.success(`${channel === "email" ? "Email" : "WhatsApp"} enviado`);
      } else {
        toast.success(`Borrador guardado`);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Componer Mensaje" subtitle="Crea mensajes personalizados" wide>
      <div className="space-y-5">
        {/* Type Selector */}
        <div>
          <label className="block text-xs font-medium text-[#9C8A82] mb-2">Tipo de Mensaje</label>
          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm flex items-center justify-between hover:border-[#B8837E]/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <currentTemplate.icon size={18} className="text-[#B8837E]" />
                <div className="text-left">
                  <div className="font-medium">{currentTemplate.label}</div>
                  <div className="text-xs text-[#9C8A82]">{currentTemplate.description}</div>
                </div>
              </div>
              <ChevronDown size={18} className={`text-[#9C8A82] transition-transform ${showTypeDropdown ? "rotate-180" : ""}`} />
            </button>

            {showTypeDropdown && (
              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-[#E8E0D8] rounded-xl shadow-lg overflow-hidden">
                {MESSAGE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        setMessageType(type.id);
                        setShowTypeDropdown(false);
                        setFieldValues({});
                        setSelectedInvoiceId("");
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#FAF6F0] transition-colors ${
                        messageType === type.id ? "bg-[#B8837E]/10" : ""
                      }`}
                    >
                      <Icon size={18} className="text-[#B8837E]" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-[#5C3E35]">{type.label}</div>
                        <div className="text-xs text-[#9C8A82]">{type.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Channel Selector */}
        <div>
          <label className="block text-xs font-medium text-[#9C8A82] mb-2">Canal</label>
          <div className="flex gap-3">
            <button
              onClick={() => setChannel("email")}
              className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                channel === "email"
                  ? "bg-[#B8837E] text-white"
                  : "border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0]"
              }`}
            >
              <Send size={16} /> Email
            </button>
            <button
              onClick={() => setChannel("whatsapp")}
              className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                channel === "whatsapp"
                  ? "bg-[#86C7A3] text-white"
                  : "border border-[#E8E0D8] text-[#5C3E35] hover:bg-[#FAF6F0]"
              }`}
            >
              <Send size={16} /> WhatsApp
            </button>
          </div>
        </div>

        {/* Client Selection with New Client Button */}
        {currentTemplate.fields.some(f => f.type === "client") && (
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-2">Cliente</label>
            <div className="flex gap-2">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/clientes?nuevo=true");
                }}
                className="h-10 px-3 rounded-xl border border-[#B8837E] text-[#B8837E] text-sm font-medium hover:bg-[#B8837E]/10 transition-all flex items-center gap-1"
              >
                <Plus size={14} /> Nuevo
              </button>
            </div>
          </div>
        )}

        {/* Invoice Selection (filtered by client) */}
        {currentTemplate.fields.some(f => f.type === "invoice") && selectedClientId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[#9C8A82]">Factura</label>
              <button
                type="button"
                onClick={() => setShowInvoice(!showInvoice)}
                className="flex items-center gap-1.5 text-xs text-[#9C8A82] hover:text-[#5C3E35]"
              >
                {showInvoice ? <ToggleRight size={18} className="text-[#86C7A3]" /> : <ToggleLeft size={18} />}
                {showInvoice ? "Visible en mensaje" : "Oculta en mensaje"}
              </button>
            </div>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
            >
              <option value="">Sin factura (seleccionar producto manualmente)</option>
              {clientInvoices.map((inv: any) => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} - RD${Number(inv.total).toLocaleString()}</option>
              ))}
            </select>
          </div>
        )}

        {/* Product Selection */}
        {currentTemplate.fields.some(f => f.type === "product") && (
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-2">Productos</label>
            {selectedInvoiceId && showInvoice ? (
              <div className="bg-[#FAF6F0] rounded-xl p-3 space-y-1">
                {invoiceProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm text-[#5C3E35]">
                    <span>• {p.name}</span>
                    <span className="text-[#9C8A82]">x{p.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                  />
                </div>
                <select
                  value={fieldValues.lista_productos || ""}
                  onChange={(e) => handleFieldChange("lista_productos", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Seleccionar producto...</option>
                  {products
                    .filter(p => p.active)
                    .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                    .map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Other Fields */}
        {currentTemplate.fields
          .filter(f => f.type !== "client" && f.type !== "invoice" && f.type !== "product")
          .map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-[#5C3E35] mb-1">
                {field.label}
                {field.required && <span className="text-[#D4A0A0] ml-1">*</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  value={fieldValues[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 resize-none"
                />
              ) : (
                <input
                  type={field.type}
                  value={fieldValues[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                />
              )}
            </div>
          ))}

        {/* Subject (Email only) */}
        {channel === "email" && (
          <div>
            <label className="block text-xs font-medium text-[#9C8A82] mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del mensaje..."
              className="w-full h-11 px-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
            />
          </div>
        )}

        {/* Message Body */}
        <div>
          <label className="block text-xs font-medium text-[#9C8A82] mb-1">Mensaje</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Escribe tu mensaje aquí..."
            className="w-full resize-y px-4 py-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 whitespace-pre-wrap"
          />
          <p className="text-xs text-[#9C8A82] mt-1">
            Variables disponibles: {"{{nombre_cliente}}"}, {"{{numero_factura}}"}, {"{{monto_total}}"}, {"{{empresa}}"}, {"{{nombre_vendedor}}"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Borrador"}
          </button>
          <button
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex-1 h-12 bg-[#86C7A3] text-white rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} /> Enviar
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
