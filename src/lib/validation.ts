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
  type: z.enum(["text", "template"]),
  text: z.string().max(4096).optional(),
  template: z
    .object({
      name: z.string().min(1),
      language: z.object({ code: z.string().min(2).max(5) }).optional(),
      components: z.array(z.any()).optional(),
    })
    .optional(),
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

export const recommendationsSchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(20).optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.enum(["es", "en"]).optional(),
  notifications: z.boolean().optional(),
});

export const backupSchema = z.object({
  tables: z.array(z.string()).optional(),
  includeStorage: z.boolean().optional(),
});

export const parsePurchaseSchema = z.object({
  text: z.string().min(1).max(50000),
  supplierId: z.string().uuid().optional(),
});

export const guidesSchema = z.object({
  category: z.string().optional(),
  lang: z.enum(["es", "en"]).optional(),
});

export const aiRecommendationsSchema = z.object({
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

export const validateBody = <T extends z.ZodTypeAny>(
  schema: T
) => async (req: Request): Promise<z.infer<T>> => {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = (error as any).issues ?? (error as any).errors ?? [];
      const messages = issues.map((e: any) => `${e.path?.join(".") ?? ""}: ${e.message}`).join("; ");
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