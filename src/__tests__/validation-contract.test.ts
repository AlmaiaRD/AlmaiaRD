import { describe, it, expect } from "vitest";
import {
  parsePurchaseSchema,
  recommendationsSchema,
  aiRecommendationsSchema,
  aiChatSchema,
} from "@/lib/validation";

describe("validation: los schemas deben coincidir con lo que envia el cliente", () => {
  /**
   * Estos tres casos reproducian 400 en produccion:
   *
   *  - parsePurchaseSchema exigia `text`, pero PurchasePdfImport.tsx manda
   *    `{ images, catalog }`. Toda importacion de factura por PDF fallaba.
   *  - recommendationsSchema exigia `query` no vacio, pero
   *    getAISeasonalRecommendations manda solo `{ season, type: "seasonal" }`.
   *  - aiRecommendationsSchema no declaraba `query` ni `season`, que es lo que
   *    la ruta lee; zod no valida campos desconocidos, asi que `query` podia
   *    llegar como undefined.
   */
  it("acepta el cuerpo real de /api/parse-purchase", () => {
    const body = {
      images: ["data:image/png;base64,iVBORw0KGgo="],
      catalog: [{ id: "abc", name: "Crema", code: "C-1" }],
    };
    const r = parsePurchaseSchema.safeParse(body);
    expect(r.success).toBe(true);
  });

  it("rechaza parse-purchase sin imagenes", () => {
    expect(parsePurchaseSchema.safeParse({ images: [] }).success).toBe(false);
  });

  it("rechaza parse-purchase con mas de 10 paginas", () => {
    const images = Array.from({ length: 11 }, () => "data:image/png;base64,x");
    expect(parsePurchaseSchema.safeParse({ images }).success).toBe(false);
  });

  it("acepta el modo estacional sin query", () => {
    const r = recommendationsSchema.safeParse({ season: "otoño", type: "seasonal" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.query).toBe("");
  });

  it("acepta los cuatro nombres de estacion con enye", () => {
    for (const season of ["verano", "invierno", "primavera", "otoño"]) {
      const r = recommendationsSchema.safeParse({ season, type: "seasonal" });
      expect(r.success, `estacion ${season} rechazada`).toBe(true);
    }
  });

  it("exige query en el modo busqueda", () => {
    expect(recommendationsSchema.safeParse({ query: "vitaminas" }).success).toBe(true);
    expect(recommendationsSchema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("exige season en el modo estacional", () => {
    expect(recommendationsSchema.safeParse({ type: "seasonal" }).success).toBe(false);
  });

  it("da query por defecto en ai-recommendations", () => {
    const r = aiRecommendationsSchema.safeParse({ season: "invierno" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.query).toBe("");
  });

  it("ai-recommendations sigue aceptando clientId y productIds", () => {
    // UUIDs válidos (versión 4)
    const r = aiRecommendationsSchema.safeParse({
      query: "piel",
      clientId: "3f2a4b6c-8d1e-4f5a-9b7c-1d2e3f4a5b6c",
      productIds: ["9a8b7c6d-5e4f-4a2b-9c0d-9e8f7a6b5c4d"],
    });
    expect(r.success).toBe(true);
  });

  it("ai-chat sigue exigiendo query no vacia", () => {
    expect(aiChatSchema.safeParse({ query: "hola" }).success).toBe(true);
    expect(aiChatSchema.safeParse({ query: "" }).success).toBe(false);
  });
});