import { describe, it, expect } from "vitest";
import { preferencesSchema, imageProxySchema } from "@/lib/validation";

describe("preferencesSchema", () => {
  it("valida claves conocidas", () => {
    const parsed = preferencesSchema.parse({ theme: "dark", notifications: false });
    expect(parsed).toMatchObject({ theme: "dark", notifications: false });
  });

  it("permite claves dinámicas (passthrough de preferencias libres)", () => {
    const parsed = preferencesSchema.parse({
      theme: "light",
      sidebar_collapsed: true,
      goal_month: "2026-09",
    });
    expect(parsed.sidebar_collapsed).toBe(true);
    expect(parsed.goal_month).toBe("2026-09");
  });

  it("rechaza valores inválidos en claves conocidas", () => {
    expect(() => preferencesSchema.parse({ theme: "neon" })).toThrow();
    expect(() => preferencesSchema.parse({ notifications: "si" })).toThrow();
  });
});

describe("imageProxySchema", () => {
  it("acepta una URL válida", () => {
    expect(imageProxySchema.parse({ url: "https://example.com/a.png" }).url).toContain("example.com");
  });

  it("rechaza URLs no válidas", () => {
    expect(() => imageProxySchema.parse({ url: "no-es-una-url" })).toThrow();
    expect(() => imageProxySchema.parse({})).toThrow();
  });
});