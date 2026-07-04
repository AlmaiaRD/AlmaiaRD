import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key no configurada. Agrega OPENAI_API_KEY en .env.local" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { query, season, type } = body;

    // Fetch products from Supabase
    const { data: products } = await supabase
      .from("products")
      .select(`
        id,
        name,
        code,
        price_30,
        subbrands (name),
        categories (name)
      `)
      .limit(200);

    if (!products || products.length === 0) {
      return NextResponse.json({ recommendations: [], message: "No hay productos en el catálogo" });
    }

    // Build product catalog for the AI
    const catalog = products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      price: p.price_30,
      subbrand: (p.subbrands as any)?.name || "Sin submarca",
      category: (p.categories as any)?.name || "Sin categoría",
    }));

    let systemPrompt = `Eres un asistente de ventas de Almaia RD, distribuidora autorizada Amway en República Dominicana. 
Tu tarea es recomendar productos del catálogo basándote en las necesidades del cliente.

IMPORTANTE: Responde SOLO con un JSON válido, sin texto adicional.
El JSON debe ser un array de objetos con esta estructura:
[
  {
    "product_id": "id del producto",
    "product_name": "nombre del producto",
    "code": "código",
    "subbrand": "submarca",
    "reason": "por qué recomiendas este producto (en español, 1-2 oraciones)",
    "priority": "high" | "medium" | "low",
    "score": número del 1 al 10
  }
]

Máximo 8 recomendaciones. Ordena por relevancia (score alto primero).
Si no hay productos relevantes, responde con un array vacío: []`;

    if (season) {
      const seasonDescriptions: Record<string, string> = {
        verano: "Es verano (temporada calurosa). Recomienda productos para protección solar, hidratación, energía, cuidado capilar por el sol, desodorante.",
        invierno: "Es invierno (temporada de lluvias). Recomienda vitaminas, suplementos para inmunidad, cremas hidratantes, cuidado de piel.",
        primavera: "Es primavera. Recomienda productos de limpieza del hogar, renovación, energía, cuidado personal.",
        otoño: "Es otoño. Recomienda productos de transición, hidratación, cuidado personal, vitaminas.",
      };
      systemPrompt += `\n\nContexto de temporada: ${seasonDescriptions[season] || ""}`;
    }

    const userMessage = type === "seasonal"
      ? `Recomienda productos para la temporada de ${season}. Catálogo disponible:\n${JSON.stringify(catalog)}`
      : `Necesidad del cliente: "${query}"\n\nCatálogo de productos disponible:\n${JSON.stringify(catalog)}`;

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || "Error al conectar con OpenAI" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const recommendations = JSON.parse(jsonStr.trim());
      return NextResponse.json({ recommendations: Array.isArray(recommendations) ? recommendations : [] });
    } catch {
      return NextResponse.json({ recommendations: [], error: "No se pudo procesar la respuesta de la IA" });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
