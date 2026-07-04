import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface ProductRec {
  product_id: string;
  product_name: string;
  code: string;
  subbrand: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
}

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 1000 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.response || null;
  } catch {
    return null;
  }
}

function keywordFallback(
  products: any[],
  query: string,
  season?: string
): ProductRec[] {
  const recommendations: ProductRec[] = [];
  const words = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);

  const seasonKeywords: Record<string, string[]> = {
    verano: ["protector solar", "sun", "spf", "hidratante", "fresco", "energia", "omega", "vitamina c", "antioxidante", "shampoo", "desodorante"],
    invierno: ["nutrilite", "vitamina", "suplemento", "inmunidad", "omega", "proteina", "crema", "locion", "piel", "artistry", "hidratante", "jabon"],
    primavera: ["limpieza", "detergente", "lavanderia", "desinfectante", "shampoo", "energia", "protein", "exfoliante"],
    otoño: ["crema", "locion", "piel", "artistry", "hidratante", "nutrilite", "vitamina", "suplemento", "jabon", "shampoo"],
  };

  const extraKeywords = season ? seasonKeywords[season] || [] : [];

  for (const product of products) {
    const name = (product.name || "").toLowerCase();
    const subbrand = ((product.subbrands as any)?.name || "").toLowerCase();
    const category = ((product.categories as any)?.name || "").toLowerCase();
    const desc = (product.description || "").toLowerCase();
    const benefits = (product.benefits || "").toLowerCase();
    const combined = `${name} ${subbrand} ${category} ${desc} ${benefits}`;

    let score = 0;
    let reason = "";
    const allKeywords = [...words, ...extraKeywords];

    for (const keyword of allKeywords) {
      if (keyword.length < 2) continue;
      if (name.includes(keyword)) {
        const s = keyword.length > 4 ? 10 : 8;
        if (s > score) { score = s; reason = `Nombre contiene "${keyword}"`; }
      } else if (subbrand.includes(keyword)) {
        const s = keyword.length > 4 ? 8 : 6;
        if (s > score) { score = s; reason = `Submarca ${subbrand} relacionada`; }
      } else if (category.includes(keyword)) {
        if (6 > score) { score = 6; reason = `Categoría ${category} relacionada`; }
      } else if (desc.includes(keyword) || benefits.includes(keyword)) {
        if (6 > score) { score = 6; reason = `Descripción relacionada con "${keyword}"`; }
      } else if (combined.includes(keyword)) {
        if (4 > score) { score = 4; reason = `Relacionado con "${keyword}"`; }
      }
    }

    if (score > 0) {
      recommendations.push({
        product_id: product.id,
        product_name: product.name,
        code: product.code,
        subbrand: (product.subbrands as any)?.name || "",
        reason,
        priority: score >= 8 ? "high" : score >= 6 ? "medium" : "low",
        score,
      });
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .filter((r, i, self) => i === self.findIndex((x) => x.product_id === r.product_id))
    .slice(0, 15);
}

export async function POST(req: NextRequest) {
  try {
    const { query, season } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Consulta requerida" }, { status: 400 });
    }

    const { data: products } = await supabase
      .from("products")
      .select(`id, name, code, description, benefits, subbrands (name), categories (name)`)
      .limit(200);

    if (!products || products.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const truncate = (s: string, max: number) => s?.length > max ? s.slice(0, max) + "..." : s || "";

    const catalog = products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: truncate(p.description, 200),
      benefits: truncate(p.benefits, 200),
      subbrand: (p.subbrands as any)?.name || "Genérica",
      category: (p.categories as any)?.name || "Sin categoría",
    }));

    let context = "";
    if (season) {
      const labels: Record<string, string> = {
        verano: "Es verano (calor). El cliente busca productos para protección solar, hidratación, energía, cuidado capilar, frescura.",
        invierno: "Es invierno (lluvias, frío). El cliente busca vitaminas, suplementos para inmunidad, cremas hidratantes, cuidado de piel, protección.",
        primavera: "Es primavera. El cliente busca productos de limpieza del hogar, renovación, energía, cuidado personal, frescura.",
        otoño: "Es otoño (transición). El cliente busca hidratación, cuidado personal, vitaminas, cremas, productos de confort.",
      };
      context = labels[season] || "";
    }

    const prompt = `Eres un asesor de ventas experto de Almaia RD, distribuidora Amway.

Catálogo (cada producto incluye nombre, descripción y beneficios):
${JSON.stringify(catalog)}

Instrucciones:
- Necesidad del cliente: "${query}"
- ${context}
- USA la descripción y beneficios de cada producto para determinar qué tan útil es para la necesidad del cliente.
- Selecciona los 6-10 productos MÁS relevantes.
- Devuelve SOLO un JSON array, sin texto adicional, sin markdown.
- Formato exacto: [{"product_id":"...","product_name":"...","code":"...","subbrand":"...","reason":"...","priority":"high|medium|low","score":N}]
- "reason" debe explicar por qué es útil, mencionando brevemente sus beneficios (1 oración en español).
- Ordena por score descendente (mejor primero).
- Si ningún producto es relevante, devuelve []`;

    let ollamaResponse = await callOllama(prompt);
    let recommendations: ProductRec[] = [];

    if (ollamaResponse) {
      try {
        const jsonMatch = ollamaResponse.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            recommendations = parsed;
          }
        }
      } catch {}
    }

    if (!recommendations.length) {
      recommendations = keywordFallback(products, query, season);
    }

    return NextResponse.json({ recommendations });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
