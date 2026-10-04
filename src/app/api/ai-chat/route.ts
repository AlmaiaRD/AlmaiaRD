import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { aiChatSchema, validateBody } from "@/lib/validation";
import { generateText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof aiChatSchema>;
  try {
    payload = await validateBody(aiChatSchema)(req);
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
  const limit = await checkRateLimit(`ai-chat:${ip}`, 10, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { query } = payload;

    const { data: products } = await supabase
      .from("products")
      .select(`id, name, code, description, benefits, subbrands (name), categories (name)`)
      .limit(200);

    const truncate = (s: string, max: number) => s?.length > max ? s.slice(0, max) + "..." : s || "";

    const catalogList = (products || [])
      .map(
        (p) =>
          `- ${p.name} (${(p.subbrands as { name?: string | null } | null)?.name || "Genérica"}) - ${(p.categories as { name?: string | null } | null)?.name || "Sin categoría"}${p.description ? ` | ${truncate(p.description, 150)}` : ""}${p.benefits ? ` | Beneficios: ${truncate(p.benefits, 150)}` : ""}`
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

    // `generateText` recorre los proveedores configurados (Groq, OpenRouter,
    // Ollama, OpenAI) y devuelve el primero que responda. Sin ninguna clave
    // devuelve `text: null` en vez de lanzar, de modo que esta ruta degrada a
    // un mensaje útil en lugar de un 500.
    const { text, provider } = await generateText({
      system: "Eres un asesor de ventas experto y amable.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 600,
    });

    if (!text) {
      return NextResponse.json({
        response:
          "Lo siento, el asistente IA no está disponible en este momento. Intenta de nuevo o usa la búsqueda por palabras clave.",
        offline: true,
      });
    }

    return NextResponse.json({ response: text, offline: false, provider });
  } catch {
    console.error("[ai-chat] error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
