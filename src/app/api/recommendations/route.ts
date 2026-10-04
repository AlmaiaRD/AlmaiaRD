import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { recommendationsSchema, validateBody } from "@/lib/validation";
import { generateText, extractJsonArray } from "@/lib/ai";
import { keywordRecommendations } from "@/lib/ai-keywords";

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof recommendationsSchema>;
  try {
    payload = await validateBody(recommendationsSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`recommendations:${ip}`, 10, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  // Antes esta ruta devolvia 500 si no habia clave de OpenAI. Ahora la IA es
  // opcional: si no hay ninguna configurada, se responde con las
  // recomendaciones por palabras clave, que para un catalogo de 207 productos
  // da resultados aprovechables.
  try {
    const { query, season, type } = payload;

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
      subbrand: (p.subbrands as { name?: string | null } | null)?.name || "Sin submarca",
      category: (p.categories as { name?: string | null } | null)?.name || "Sin categoría",
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

    const { text, provider } = await generateText({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.3,
      maxTokens: 1500,
    });

    const fromIA = text ? extractJsonArray(text) : null;
    if (fromIA) {
      return NextResponse.json({ recommendations: fromIA, provider, viaIA: true });
    }

    const fallback = keywordRecommendations(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        subbrand: (p.subbrands as { name?: string | null } | null)?.name || "",
        category: (p.categories as { name?: string | null } | null)?.name || "",
      })),
      type === "seasonal" ? "" : query || "",
      season,
      8
    );

    return NextResponse.json({
      recommendations: fallback,
      provider: null,
      viaIA: false,
      ...(fallback.length === 0 && type !== "seasonal"
        ? { error: "No se encontraron productos que coincidan con la búsqueda." }
        : {}),
    });
  } catch {
    console.error("[recommendations] error");
    return NextResponse.json(
      { error: "Error interno al generar recomendaciones" },
      { status: 500 }
    );
  }
}