import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { aiRecommendationsSchema, validateBody } from "@/lib/validation";
import { generateText, extractJsonArray } from "@/lib/ai";
import { keywordRecommendations } from "@/lib/ai-keywords";

interface ProductRec {
  product_id: string;
  product_name: string;
  code: string;
  subbrand: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
}

// El respaldo por palabras clave vive ahora en `src/lib/ai-keywords.ts`,
// compartido con las demas rutas de IA. Antes estaba duplicado aqui.

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof aiRecommendationsSchema>;
  try {
    payload = await validateBody(aiRecommendationsSchema)(req);
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
  const limit = await checkRateLimit(`ai-recommendations:${ip}`, 10, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { query, season } = payload;
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
      subbrand: (p.subbrands as { name?: string | null } | null)?.name || "Genérica",
      category: (p.categories as { name?: string | null } | null)?.name || "Sin categoría",
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

    const { text, provider } = await generateText({
      system: "Eres un asesor de ventas experto de Almaia RD que devuelve SOLO JSON.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1500,
    });

    let recommendations: ProductRec[] = [];
    if (text) {
      const parsed = extractJsonArray(text);
      if (parsed && parsed.length > 0) {
        recommendations = parsed as ProductRec[];
      }
    }

    // Sin IA, o si la respuesta no era JSON valido, se busca por palabras
    // clave: el usuario recibe resultados utiles en lugar de un error.
    if (!recommendations.length) {
      recommendations = keywordRecommendations(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          description: p.description,
          benefits: p.benefits,
          subbrand: (p.subbrands as { name?: string | null } | null)?.name || "",
          category: (p.categories as { name?: string | null } | null)?.name || "",
        })),
        query,
        season
      ) as ProductRec[];
    }

    return NextResponse.json({ recommendations, provider, viaIA: Boolean(text && recommendations.length) });
  } catch {
    console.error("[ai-recommendations] error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}