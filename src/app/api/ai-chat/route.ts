import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un asesor de ventas experto y amable." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = checkRateLimit(`ai-chat:${ip}`, 10, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

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

    const response = await callOpenAI(prompt);

    if (!response) {
      return NextResponse.json({
        response:
          "Lo siento, el asistente IA no está disponible en este momento. Intenta de nuevo o usa la búsqueda por palabras clave.",
        offline: true,
      });
    }

    return NextResponse.json({ response, offline: false });
  } catch {
    console.error("[ai-chat] error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
