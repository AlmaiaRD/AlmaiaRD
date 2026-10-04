import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePurchaseSchema, validateBody } from "@/lib/validation";
import { generateText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof parsePurchaseSchema>;
  try {
    payload = await validateBody(parsePurchaseSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

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
    const limit = await checkRateLimit(`parse-purchase:${ip}`, 5, 60000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    // Esta ruta SI necesita una IA con capacidad de ver imagenes: no hay forma de
    // extraer una factura sin leerla. A diferencia de las otras, sin proveedor
    // de vision configurado no hay alternativa local, asi que se explica con
    // claridad en vez de devolver un error generico.
    // El schema ya garantiza 1..10 imagenes; no se repite la comprobacion.
    const { images, catalog } = payload;

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

    const { text: content, error } = await generateText({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage, imageUrls: images.slice(0, 10) }],
      temperature: 0.1,
      maxTokens: 4000,
      timeoutMs: 60_000,
    });

    if (!content) {
      // 503 y no 500: la peticion es valida, lo que falta es un proveedor
      // configurado en el servidor. No es culpa de quien la hizo.
      const sinVision = error === "sin proveedor de IA configurado";
      return NextResponse.json(
        {
          error: sinVision
            ? "La lectura automática de facturas necesita una IA que pueda ver imágenes. Configura GROQ_API_KEY en el servidor (es gratis) para activarla."
            : "No se pudo leer la factura con el proveedor de IA configurado. Intenta de nuevo.",
          ...(sinVision ? { code: "NO_VISION_PROVIDER" } : {}),
        },
        { status: 503 }
      );
    }

    const jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/, "$1").trim();

    try {
      const parsed = JSON.parse(jsonStr);
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