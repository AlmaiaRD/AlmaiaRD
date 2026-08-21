import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const limit = checkRateLimit(`parse-purchase:${ip}`, 5, 60000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY no configurada en el servidor" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { images, catalog } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No se recibieron imágenes del PDF" }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ error: "El PDF tiene más de 10 páginas. Máximo soportado: 10." }, { status: 400 });
    }

    const imageContent = images.slice(0, 10).map((img: string) => ({
      type: "image_url",
      image_url: { url: img },
    }));

    const systemPrompt = `Eres un asistente de inventario de Almaia RD, distribuidora autorizada Amway en República Dominicana.

Recibirás una o más imágenes de una factura de compra (purchase order/invoice) de Amway.

Tu tarea: extraer los datos de la compra con la mayor fidelidad posible.

Responde SOLO con un JSON válido, sin texto adicional ni markdown. La estructura es:
{
  "supplier_name": "nombre del proveedor (de la factura, ej: Amway)",
  "purchase_date": "fecha de la factura en formato YYYY-MM-DD (si no está clara, usa el día de hoy)",
  "notes": "notas relevantes si las hay, si no cadena vacía",
  "discount_amount": número,
  "items": [
    {
      "name": "nombre del producto tal como aparece",
      "code": "código del producto si aparece",
      "quantity": número,
      "unit_cost": número (precio unitario, sin impuesto),
      "itbis": true/false (true si el producto lleva ITBIS 18%)
    }
  ]
}

Reglas:
- Incluye TODOS los productos visibles en la factura, aunque estén repetidos.
- No inventes productos ni precios. Si un dato no es legible, usa null o el valor más cercano razonable.
- unit_cost debe ser el precio unitario del producto.
- quantity debe ser el número de unidades.
- Si aparece un subtotal, impuestos o total en la factura, úsalos para validar tus cálculos.
- La moneda es pesos dominicanos (RD$).`;
    const userMessage = `Estas son las imágenes de la factura de compra. Catálogo de referencia de productos disponibles (para que puedas matchear nombres):
${JSON.stringify(catalog || [])}

Extrae la compra completa en el JSON según el formato indicado.`;

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
          { role: "user", content: [{ type: "text", text: userMessage }, ...imageContent] },
        ],
        temperature: 0.1,
        max_tokens: 4000,
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
    const content = data.choices?.[0]?.message?.content || "{}";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonStr.trim());
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return NextResponse.json({
        parsed: {
          supplier_name: parsed.supplier_name || "",
          purchase_date: parsed.purchase_date || new Date().toISOString().slice(0, 10),
          notes: parsed.notes || "",
          discount_amount: Number(parsed.discount_amount || 0),
          items,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "No se pudo interpretar la respuesta de la IA. Intenta de nuevo." },
        { status: 500 }
      );
    }
  } catch {
    console.error("[parse-purchase] error");
    return NextResponse.json(
      { error: "Error al procesar la factura. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
