import { describe, it, expect } from "vitest";
import { generateOpenApiDocument } from "@/lib/openapi";

describe("OpenAPI document", () => {
  const doc = generateOpenApiDocument();

  it("produce un documento OpenAPI válido", () => {
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info.title).toContain("Almaia RD");
    expect(doc.servers?.[0]?.url).toBeTruthy();
  });

  it("define el esquema de seguridad bearer", () => {
    expect(doc.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  it("registra las rutas principales de la API", () => {
    const expectedPaths = [
      "/api/ai-chat",
      "/api/ai-recommendations",
      "/api/backup",
      "/api/client-summary",
      "/api/guides",
      "/api/image-proxy",
      "/api/inventory-analysis",
      "/api/log",
      "/api/migrate",
      "/api/parse-purchase",
      "/api/preferences",
      "/api/recommendations",
      "/api/send-email",
      "/api/setup-storage",
      "/api/validate-invoice",
      "/api/whatsapp/send",
      "/api/whatsapp/templates",
      "/api/whatsapp/webhook",
    ];
    for (const p of expectedPaths) {
      expect(doc.paths[p], `debería existir la ruta ${p}`).toBeDefined();
    }
  });

  it("genera request bodies a partir de los schemas Zod", () => {
    const aiChat = doc.paths["/api/ai-chat"]?.post;
    const rb = aiChat?.requestBody as
      | { content?: Record<string, { schema?: unknown }> }
      | undefined;
    const schema = rb?.content?.["application/json"]?.schema;
    expect(schema).toBeDefined();
  });
});
