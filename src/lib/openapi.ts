import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  aiChatSchema,
  aiRecommendationsSchema,
  backupSchema,
  clientSummarySchema,
  inventoryAnalysisSchema,
  parsePurchaseSchema,
  preferencesSchema,
  recommendationsSchema,
  sendEmailSchema,
  whatsappSendSchema,
  whatsappTemplatesSchema,
} from "@/lib/validation";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
});

// ---------------------------------------------------------------------------
// Componentes / esquemas comunes de respuesta
// ---------------------------------------------------------------------------

const errorResponse = z.object({
  error: z.string(),
});

const unauthorizedResponse = z.object({
  error: z.literal("No autorizado"),
});

const createErrorResponses = (extra?: Record<number, object>) => ({
  400: {
    description: "Solicitud inválida",
    content: { "application/json": { schema: errorResponse } },
  },
  401: {
    description: "No autorizado",
    content: { "application/json": { schema: unauthorizedResponse } },
  },
  403: {
    description: "Prohibido",
    content: { "application/json": { schema: errorResponse } },
  },
  429: {
    description: "Demasiadas solicitudes",
    content: { "application/json": { schema: errorResponse } },
  },
  500: {
    description: "Error interno",
    content: { "application/json": { schema: errorResponse } },
  },
  ...extra,
});

const authSecurity = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Registro de rutas
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/ai-chat",
  summary: "Asistente IA de ventas",
  description:
    "Envía la consulta de un cliente a OpenAI (GPT-4o-mini) con el catálogo de productos como contexto y devuelve una recomendación de venta.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: aiChatSchema } } },
  },
  responses: {
    200: {
      description: "Respuesta del asistente",
      content: {
        "application/json": {
          schema: z.object({
            response: z.string(),
            offline: z.boolean(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ai-recommendations",
  summary: "Recomendaciones IA de productos",
  description:
    "Genera recomendaciones de productos basadas en IA según el cliente y/o productos seleccionados, con respaldo por palabras clave.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: aiRecommendationsSchema } } },
  },
  responses: {
    200: {
      description: "Lista de recomendaciones",
      content: {
        "application/json": {
          schema: z.object({
            recommendations: z.array(
              z.object({
                product_id: z.string(),
                product_name: z.string(),
                code: z.string(),
                subbrand: z.string().optional(),
                reason: z.string(),
                priority: z.number(),
                score: z.number(),
              })
            ),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/backup",
  summary: "Crear respaldo completo de la base de datos",
  description:
    "Solo administradores. Crea un respaldo JSON de todas las tablas y lo sube al bucket 'backups' en Supabase Storage.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: backupSchema } } },
  },
  responses: {
    200: {
      description: "Respaldo creado",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            backup: z.string(),
            tables: z.number(),
            rows: z.number(),
            size_mb: z.string(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/client-summary",
  summary: "Resumen IA de cliente",
  description:
    "Genera un resumen del cliente y una sugerencia de abordaje comercial usando Ollama (Llama 3.2).",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: clientSummarySchema } } },
  },
  responses: {
    200: {
      description: "Resumen del cliente",
      content: {
        "application/json": {
          schema: z.object({
            ai_summary: z.string(),
            approach: z.string(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/guides",
  summary: "Obtener guías de ayuda",
  description:
    "Devuelve las guías/documentación del sistema agrupadas por categoría. Acepta filtros por categoría e idioma.",
  security: authSecurity,
  request: {
    query: z.object({
      category: z.string().optional(),
      lang: z.enum(["es", "en"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Guías agrupadas",
      content: {
        "application/json": {
          schema: z.object({
            groups: z.array(
              z.object({
                id: z.string(),
                label: z.string(),
                files: z.array(
                  z.object({
                    id: z.string(),
                    label: z.string(),
                    filename: z.string(),
                    content: z.string(),
                  })
                ),
              })
            ),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/image-proxy",
  summary: "Proxy de imágenes externas",
  description:
    "Devuelve una imagen externa de forma segura (con protección SSRF) para usarse en <img>.",
  security: authSecurity,
  request: {
    query: z.object({
      url: z.string().url(),
    }),
  },
  responses: {
    200: {
      description: "Imagen binaria",
      content: { "image/*": { schema: { type: "string", format: "binary" } } },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/inventory-analysis",
  summary: "Análisis IA de inventario",
  description:
    "Analiza la rotación de inventario (velocidad de stock, días en inventario) y produce recomendaciones accionables.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: inventoryAnalysisSchema } } },
  },
  responses: {
    200: {
      description: "Análisis generado",
      content: {
        "application/json": {
          schema: z.object({ analysis: z.string() }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/log",
  summary: "Registrar log del cliente",
  description:
    "Recibe y registra errores/logs del lado del cliente en la consola del servidor.",
  security: authSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            level: z.enum(["log", "warn", "error", "info", "debug"]),
            message: z.string().max(2000),
            data: z.any().optional(),
            url: z.string().url().optional(),
            timestamp: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Registrado",
      content: {
        "application/json": { schema: z.object({ ok: z.literal(true) }) },
      },
    },
    400: {
      description: "Solicitud inválida",
      content: {
        "application/json": { schema: z.object({ ok: z.literal(false) }) },
      },
    },
    401: {
      description: "No autorizado",
      content: { "application/json": { schema: unauthorizedResponse } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/migrate",
  summary: "Migración SQL (solo desarrollo)",
  description:
    "Solo desarrollo. Ejecuta la migración 'create_get_user_role' vía Management API. Requiere rol admin.",
  security: authSecurity,
  responses: {
    200: {
      description: "Migración ejecutada",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            result: z.any(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/migrate",
  summary: "Migración SQL por nombre (solo desarrollo)",
  description:
    "Solo desarrollo. Ejecuta una migración predefinida por nombre. Requiere rol admin.",
  security: authSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z
              .string()
              .min(1)
              .refine((v) => ["create_get_user_role"].includes(v)),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Migración ejecutada",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            name: z.string(),
            result: z.any(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/parse-purchase",
  summary: "Extraer datos de compra",
  description:
    "Usa OpenAI (GPT-4o-mini con visión) para extraer datos de compra/factura a partir de imágenes de páginas de PDF.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: parsePurchaseSchema } } },
  },
  responses: {
    200: {
      description: "Datos extraídos",
      content: {
        "application/json": {
          schema: z.object({
            parsed: z.object({
              supplier_name: z.string().optional(),
              purchase_date: z.string().optional(),
              notes: z.string().optional(),
              discount_amount: z.number().optional(),
              items: z.array(
                z.object({
                  name: z.string(),
                  code: z.string().optional(),
                  quantity: z.number(),
                  unit_cost: z.number(),
                  itbis: z.boolean().optional(),
                })
              ),
            }),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/preferences",
  summary: "Obtener preferencias del usuario",
  description: "Devuelve las preferencias (tema, idioma, notificaciones) del usuario autenticado.",
  security: authSecurity,
  responses: {
    200: {
      description: "Preferencias",
      content: {
        "application/json": {
          schema: z.object({ preferences: z.record(z.string(), z.any()) }),
        },
      },
    },
    ...createErrorResponses(undefined),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/preferences",
  summary: "Actualizar preferencias del usuario",
  description: "Actualiza parcialmente las preferencias del usuario autenticado.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: preferencesSchema } } },
  },
  responses: {
    200: {
      description: "Preferencias actualizadas",
      content: {
        "application/json": {
          schema: z.object({ preferences: z.record(z.string(), z.any()) }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/recommendations",
  summary: "Recomendaciones de productos (OpenAI)",
  description:
    "Genera recomendaciones de productos usando OpenAI (GPT-4o-mini) a partir de la necesidad del cliente, con contexto opcional de temporada.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: recommendationsSchema } } },
  },
  responses: {
    200: {
      description: "Lista de recomendaciones",
      content: {
        "application/json": {
          schema: z.object({
            recommendations: z.array(
              z.object({
                product_id: z.string(),
                product_name: z.string(),
                code: z.string(),
                subbrand: z.string().optional(),
                reason: z.string(),
                priority: z.number(),
                score: z.number(),
              })
            ),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/send-email",
  summary: "Enviar correo",
  description:
    "Envía un correo (con adjunto opcional base64) mediante el servidor SMTP configurado (Nodemailer).",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: sendEmailSchema } } },
  },
  responses: {
    200: {
      description: "Correo enviado",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            messageId: z.string(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/setup-storage",
  summary: "Configurar bucket de imágenes",
  description:
    "Solo administradores. Crea el bucket 'product-images' en Supabase Storage y configura políticas RLS y función de signed URL.",
  security: authSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({}).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Storage configurado",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/validate-invoice",
  summary: "Validar matemática de factura",
  description:
    "Calcula subtotal, ITBIS, descuento, redondeo, total y PV de una factura a partir de sus líneas.",
  security: authSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(
              z.object({
                quantity: z.number().int().min(1).max(1000),
                unit_price: z.number().min(0).max(1000000),
                cost: z.number().min(0).max(1000000).optional(),
                itbis: z.boolean().optional(),
                pv: z.number().min(0).optional(),
              })
            ).min(1),
            discount_amount: z.number().min(0).max(5000000).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Cálculo de factura",
      content: {
        "application/json": {
          schema: z.object({
            valid: z.literal(true),
            subtotal: z.number(),
            itbis_total: z.number(),
            discount_amount: z.number(),
            rounding: z.number(),
            total: z.number(),
            pv_total: z.number(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/whatsapp/send",
  summary: "Enviar mensaje de WhatsApp",
  description:
    "Envía un mensaje de texto o plantilla vía Meta WhatsApp Business API (solo admin por RLS) y registra el resultado.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: whatsappSendSchema } } },
  },
  responses: {
    200: {
      description: "Mensaje enviado",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            messageId: z.string(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/whatsapp/templates",
  summary: "Listar plantillas de WhatsApp",
  description:
    "Solo administradores. Devuelve las plantillas de mensaje de la cuenta de negocio de Meta asociada a la configuración.",
  security: authSecurity,
  request: {
    query: z.object({ configId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Plantillas (array de Meta)",
      content: { "application/json": { schema: z.array(z.any()) } },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/whatsapp/templates",
  summary: "Crear plantilla de WhatsApp",
  description:
    "Solo administradores. Crea una plantilla de mensaje en la cuenta de negocio de Meta.",
  security: authSecurity,
  request: {
    body: { content: { "application/json": { schema: whatsappTemplatesSchema } } },
  },
  responses: {
    200: {
      description: "Plantilla creada",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            template: z.any(),
          }),
        },
      },
    },
    ...createErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/whatsapp/webhook",
  summary: "Webhook WhatsApp - verificación de suscripción",
  description:
    "Verifica la suscripción del webhook de Meta WhatsApp (desafío hub.challenge). No requiere autenticación.",
  request: {
    query: z.object({
      "hub.mode": z.enum(["subscribe"]).optional(),
      "hub.verify_token": z.string().optional(),
      "hub.challenge": z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Cadena de desafío",
      content: { "text/plain": { schema: { type: "string" } } },
    },
    403: {
      description: "Forbidden",
      content: { "text/plain": { schema: { type: "string" } } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/whatsapp/webhook",
  summary: "Webhook WhatsApp - recepción de eventos",
  description:
    "Procesa mensajes entrantes y actualizaciones de estado. Verifica la firma HMAC del payload.",
  security: [],
  request: {
    body: { content: { "application/json": { schema: z.any() } } },
  },
  responses: {
    200: {
      description: "Evento procesado",
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("ok") }),
        },
      },
    },
    401: {
      description: "Firma inválida",
      content: { "text/plain": { schema: { type: "string" } } },
    },
    403: {
      description: "Forbidden",
      content: { "text/plain": { schema: { type: "string" } } },
    },
  },
});

// ---------------------------------------------------------------------------
// Generación del documento
// ---------------------------------------------------------------------------

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Almaia RD API",
      version: "1.0.0",
      description:
        "API del sistema de gestión comercial Almaia RD (distribuidora Amway). Documentación generada automáticamente desde los esquemas Zod de validación.",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL || "https://almaia-rd.vercel.app" }],
  });
}
