import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 600 },
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

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Consulta requerida" }, { status: 400 });
    }

    const { data: products } = await supabase
      .from("products")
      .select(`id, name, code, description, benefits, subbrands (name), categories (name)`)
      .limit(200);

    const truncate = (s: string, max: number) => s?.length > max ? s.slice(0, max) + "..." : s || "";

    const catalogList = (products || [])
      .map(
        (p) =>
          `- ${p.name} (${(p.subbrands as any)?.name || "Genérica"}) - ${(p.categories as any)?.name || "Sin categoría"}${p.description ? ` | ${truncate(p.description, 150)}` : ""}${p.benefits ? ` | Beneficios: ${truncate(p.benefits, 150)}` : ""}`
      )
      .join("\n");

    const prompt = `Eres un asesor de ventas experto de Almaia RD, distribuidora autorizada Amway en República Dominicana.

Catálogo de productos disponible (con descripción y beneficios):
${catalogList}

Instrucciones:
- El cliente describe una situación o necesidad específica.
- Revisa la DESCRIPCIÓN y BENEFICIOS de cada producto para dar recomendaciones precisas.
- Recomienda 2-5 productos del catálogo que mejor se ajusten.
- Para cada producto, explica BREVEMENTE por qué es útil para su caso (máximo 1 oración). Menciona beneficios específicos.
- Sé amable, cercano y profesional.
- Si ningún producto del catálogo es relevante, sugiere amablemente consultar la tienda física.
- Responde ÚNICAMENTE en español.

Cliente: "${query}"

Asesor:`;

    const response = await callOllama(prompt);

    if (!response) {
      return NextResponse.json({
        response:
          "Lo siento, el asistente IA no está disponible en este momento. Intenta de nuevo o usa la búsqueda por palabras clave.",
        offline: true,
      });
    }

    return NextResponse.json({ response, offline: false });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
