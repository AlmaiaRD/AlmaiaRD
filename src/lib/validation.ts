import { z } from "zod";

export const aiChatSchema = z.object({
  query: z.string().min(1).max(2000),
});

export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  attachment: z
    .object({
      base64: z.string().max(5 * 1024 * 1024), // 5MB max
      filename: z.string().max(255),
    })
    .optional(),
});

export const whatsappSendSchema = z.object({
  configId: z.string().uuid(),
  to: z.string().regex(/^\+?[1-9]\d{1,14}$/), // E.164 format
  type: z.enum(["text", "template", "image", "document", "audio", "video"]),
  text: z.string().max(4096).optional(),
  mediaUrl: z.string().url().max(2048).optional(),
  filename: z.string().max(255).optional(),
  template: z
    .object({
      name: z.string().min(1),
      language: z.object({ code: z.string().min(2).max(5) }).optional(),
      components: z.array(z.any()).optional(),
    })
    .optional(),
});

export const telegramSendSchema = z
  .object({
    configId: z.string().uuid(),
    chatId: z.string().min(1).max(64),
    text: z.string().max(4096),
    mediaUrl: z.string().url().max(2048).optional(),
    mediaType: z.enum(["photo", "document", "video", "audio"]).optional(),
  })
  .refine((data) => !data.mediaUrl || !!data.mediaType, {
    message: "mediaType es requerido cuando se envía media",
  });

export const imageProxySchema = z.object({
  url: z.string().url(),
});

export const validateInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  action: z.enum(["validate", "fix"]).optional(),
});

export const inventoryAnalysisSchema = z.object({
  productIds: z.array(z.string().uuid()).optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
});

export const clientSummarySchema = z.object({
  clientId: z.string().uuid(),
});

/**
 * Cuerpo de POST /api/recommendations.
 *
 * Hay dos modos, y por eso `query` es opcional:
 *   - type "need"     -> el cliente manda `query` (services/recommendations.ts)
 *   - type "seasonal" -> el cliente manda solo `season`, sin texto del usuario.
 *
 * Antes `query` era obligatorio, así que el modo estacional fallaba siempre
 * con 400 y la pestaña de recomendaciones por temporada no cargaba nada.
 */
export const recommendationsSchema = z
  .object({
    query: z.string().max(2000).optional().default(""),
    season: z.enum(["verano", "invierno", "primavera", "otoño"]).optional(),
    type: z.enum(["need", "seasonal"]).optional().default("need"),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .refine((v) => v.type !== "seasonal" || Boolean(v.season), {
    message: "El modo estacional requiere 'season'",
    path: ["season"],
  })
  .refine((v) => v.type !== "need" || v.query.trim().length > 0, {
    message: "La búsqueda requiere 'query'",
    path: ["query"],
  });

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.enum(["es", "en"]).optional(),
  notifications: z.boolean().optional(),
}).passthrough();

export const backupSchema = z.object({
  tables: z.array(z.string()).optional(),
  includeStorage: z.boolean().optional(),
});

/**
 * Cuerpo de POST /api/parse-purchase.
 *
 * Antes este schema pedía `text: string`, pero el cliente
 * (components/purchases/PurchasePdfImport.tsx) envía `{ images, catalog }`.
 * Toda importación de factura por PDF fallaba con 400 "Validación fallida"
 * sin llegar a ejecutar nada. El schema debe describir lo que el cliente
 * realmente manda.
 *
 * El limite de 10 imágenes y el tamaño máximo por imagen ya los comprobaba
 * la ruta; aquí se fijan de nuevo para que la validación no dependa de que
 * la ruta se lea.
 */
export const parsePurchaseSchema = z.object({
  images: z
    .array(z.string().min(1))
    .min(1, "No se recibieron imágenes del PDF")
    .max(10, "El PDF tiene más de 10 páginas. Máximo soportado: 10."),
  catalog: z
    .array(z.object({ id: z.string(), name: z.string().optional(), code: z.string().optional() }))
    .optional()
    .default([]),
});


export const guidesSchema = z.object({
  category: z.string().optional(),
  lang: z.enum(["es", "en"]).optional(),
});

/**
 * Cuerpo de POST /api/ai-recommendations.
 *
 * Antes solo declaraba `clientId`/`productIds`/`type`, que esta ruta nunca
 * lee: la ruta usa `query` y `season`. Zod no se queja de campos desconocidos,
 * asi que la validacion pasaba sin comprobar nada y `query` podia llegar a
 * ser `undefined`. Ahora el schema refleja lo que la ruta consume.
 */
export const aiRecommendationsSchema = z.object({
  query: z.string().max(2000).optional().default(""),
  season: z.enum(["verano", "invierno", "primavera", "otoño"]).optional(),
  clientId: z.string().uuid().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  type: z.enum(["cross-sell", "upsell", "replenish"]).optional(),
});

export const whatsappTemplatesSchema = z.object({
  configId: z.string().uuid(),
  template: z.object({
    name: z.string().min(1).max(128),
    language: z.string().min(2).max(10),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
    components: z.array(
      z.object({
        type: z.enum(["HEADER", "BODY", "FOOTER", "BUTTONS"]),
        text: z.string().max(1024).optional(),
        format: z.string().optional(),
        example: z.object({ header_handle: z.array(z.string()).optional() }).optional(),
        buttons: z
          .array(
            z.object({
              type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
              text: z.string().max(20).optional(),
              url: z.string().url().optional(),
              phone_number: z.string().optional(),
            })
          )
          .optional(),
      })
    ),
  }),
});

/**
 * Valida el cuerpo de la petición contra un esquema Zod.
 *
 * IMPORTANTE — `req.clone()`:
 *   Un cuerpo de `Request` es un stream de un solo uso. Next.js entrega el body
 *   sin bufferizar (`next/dist/server/web/adapter.js` -> `body: params.request.body`),
 *   por lo que un segundo `req.json()` lanza
 *   `TypeError: Body is unusable: Body has already been read`
 *   (documentado en `next/dist/docs/.../backend-for-frontend.md`: "You can only
 *   read the request body once").
 *
 *   Doce rutas llamaban a este helper y acto seguido volvían a leer `req.json()`
 *   en el handler, con lo que TODAS devolvían 500 en cada POST bien formado
 *   (email, WhatsApp, Telegram, parseo de compras, IA). Se lee sobre un clon:
 *   el validador consume su propia copia y el `req` original queda intacto para
 *   el handler. No cambia el contrato: la función sigue devolviendo el valor
 *   parseado, y las rutas que ya usaban el valor devuelto siguen igual.
 */
export const validateBody = <T extends z.ZodTypeAny>(
  schema: T
) => async (req: Request): Promise<z.infer<T>> => {
  try {
    const body = await req.clone().json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues;
      const messages = issues.map((e) => `${e.path?.join(".") ?? ""}: ${e.message}`).join("; ");
      throw new Error(`Validación fallida: ${messages}`);
    }
    throw error;
  }
};

export const validateQuery = <T extends z.ZodTypeAny>(
  schema: T
) => (searchParams: URLSearchParams): z.infer<T> => {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
};