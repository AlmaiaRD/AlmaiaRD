import { describe, it, expect } from "vitest";
import { generateText, extractJsonArray, hasAnyProvider } from "@/lib/ai";
import { keywordRecommendations, type KeywordProduct } from "@/lib/ai-keywords";

const CATALOGO: KeywordProduct[] = [
  {
    id: "p1",
    name: "Artistry Facial Protector Solar SPF 50",
    code: "ART-001",
    description: "Proteccion solar para la cara",
    benefits: "Protege de los rayos UVA y UVB",
    subbrand: "Artistry",
    category: "Cuidado facial",
  },
  {
    id: "p2",
    name: "Nutrilite Omega 3",
    code: "NUT-010",
    description: "Suplemento de aceite de pescado",
    benefits: "Apoya el corazon y el cerebro",
    subbrand: "Nutrilite",
    category: "Vitaminas",
  },
  {
    id: "p3",
    name: "Shampoo Fresh & Clean",
    code: "GEN-020",
    description: "Shampoo para el cuidado capilar",
    benefits: "Limpia el cabello",
    subbrand: "Generica",
    category: "Cuidado personal",
  },
  {
    id: "p4",
    name: "Crema Hidratante Intensive",
    code: "ART-030",
    description: "Crema para piel seca",
    benefits: "Hidrata la piel",
    subbrand: "Artistry",
    category: "Cuidado facial",
  },
];

describe("ai-keywords: busqueda sin IA", () => {
  it("encuentra por palabra clave del cliente", () => {
    const r = keywordRecommendations(CATALOGO, "necesito algo para la piel");
    expect(r.length).toBeGreaterThan(0);
  });

  it("ordena por nombre antes que por descripcion", () => {
    const r = keywordRecommendations(CATALOGO, "shampoo");
    expect(r[0].product_id).toBe("p3");
    expect(r[0].priority).toBe("high");
  });

  it("tolera acentos distintos entre consulta y catalogo", () => {
    // El catalogo escribe "Proteccion" sin tilde; el usuario escribe con tilde.
    const r = keywordRecommendations(CATALOGO, "protección solar");
    expect(r.some((x) => x.product_id === "p1")).toBe(true);
  });

  it("no devuelve el mismo producto dos veces", () => {
    const r = keywordRecommendations(CATALOGO, "piel facial");
    const ids = r.map((x) => x.product_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respeta el limite pedido", () => {
    const r = keywordRecommendations(CATALOGO, "piel", undefined, 1);
    expect(r.length).toBeLessThanOrEqual(1);
  });

  it("devuelve vacio sin coincidencias en vez de inventar", () => {
    const r = keywordRecommendations(CATALOGO, "avioneta nuclear");
    expect(r).toEqual([]);
  });

  it("ignora palabras vacias", () => {
    const r = keywordRecommendations(CATALOGO, "de la y para con");
    expect(r).toEqual([]);
  });

  it("usa el contexto de temporada cuando la consulta es vaga", () => {
    const r = keywordRecommendations(CATALOGO, "que me recomiendas", "verano");
    expect(r.some((x) => x.product_id === "p1")).toBe(true);
  });
});

describe("ai: extraccion de JSON", () => {
  it("lee un array plano", () => {
    expect(extractJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it("lee un array envuelto en bloque de codigo", () => {
    const r = extractJsonArray('Aqui tienes:\n```json\n[{"a":1}]\n```\nlisto');
    expect(r).toEqual([{ a: 1 }]);
  });

  it("devuelve null si no hay array", () => {
    expect(extractJsonArray("no encuentro nada")).toBeNull();
  });

  it("devuelve null si el JSON esta mal formado", () => {
    expect(extractJsonArray("[{a:1}]")).toBeNull();
  });
});

describe("ai: generacion de texto", () => {
  it("devuelve texto null cuando no hay ninguna IA configurada", async () => {
    const saved = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OPENAI_API_KEY;

    const r = await generateText({ messages: [{ role: "user", content: "hola" }] });
    expect(r.text).toBeNull();
    expect(r.provider).toBeNull();

    process.env = saved;
  });

  it("reporta si hay algun proveedor disponible", () => {
    const saved = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    expect(hasAnyProvider()).toBe(false);
    process.env = saved;
  });

  it("ignora una clave de OpenAI que en realidad es un placeholder", () => {
    const saved = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    process.env.OPENAI_API_KEY = "[SEND-ME-YOUR-KEY]";
    expect(hasAnyProvider()).toBe(false);
    process.env = saved;
  });
});
