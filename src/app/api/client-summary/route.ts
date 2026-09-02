import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientSummarySchema, validateBody } from "@/lib/validation";

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 500 },
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

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

function generarResumen(client: any, stats: any): string {
  const nombre = client.full_name?.split(" ")[0] || "El cliente";
  const total = stats?.total_spent || 0;
  const pagado = stats?.total_paid || 0;
  const pendiente = stats?.pending_count || 0;
  const ticket = stats?.avg_ticket || 0;
  const compras = stats?.num_purchases || 0;
  const productos = stats?.top_products || "";
  const etapa = client.stage || "prospecto";

  const partes: string[] = [];
  partes.push(`${nombre} es un cliente en etapa "${etapa}" con ${compras} compra${compras !== 1 ? "s" : ""} realizadas.`);
  if (total > 0) {
    partes.push(`Ha facturado RD$${total.toLocaleString()} en total, de los cuales RD$${pagado.toLocaleString()} han sido pagados.`);
  }
  if (pendiente > 0) {
    partes.push(`Tiene ${pendiente} factura${pendiente !== 1 ? "s" : ""} pendiente${pendiente !== 1 ? "s" : ""} de pago.`);
  } else if (total > 0) {
    partes.push("No tiene facturas pendientes — buen historial de pago.");
  }
  if (ticket > 0) {
    partes.push(`Su ticket promedio es de RD$${ticket.toLocaleString()}.`);
  }
  if (productos) {
    const top = productos.split(",").slice(0, 3).join(", ");
    partes.push(`Productos más comprados: ${top}.`);
  }
  if (total >= 50000) {
    partes.push("Es elegible para sugerencias VIP.");
  } else if (total > 0) {
    const restante = 50000 - total;
    partes.push(`Potencial para alcanzar categoría VIP (faltan RD$${restante.toLocaleString()} en facturación).`);
  }
  return partes.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    await validateBody(clientSummarySchema)(req);
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
  const limit = await checkRateLimit(`client-summary:${ip}`, 15, 60000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
      { status: 429 }
    );
  }

  try {
    const { clientId, client, stats } = await req.json();
    if (!clientId || !client) {
      return NextResponse.json({ error: "clientId y datos requeridos" }, { status: 400 });
    }

    // Fetch settings for custom AI prompts
    const { data: settings } = await supabase
      .from("settings")
      .select("ai_client_prompt, ai_learning_prompt, sender_name, business_name")
      .single();

    let aiSummary = "";
    let approach = "";

    const templateVars = {
      clientName: client.full_name,
      stage: client.stage || "prospecto",
      totalSpent: (stats?.total_spent || 0).toLocaleString(),
      totalPaid: (stats?.total_paid || 0).toLocaleString(),
      pendingBalance: (stats?.total_spent - stats?.total_paid || 0).toLocaleString(),
      pendingCount: stats?.pending_count || 0,
      avgTicket: (stats?.avg_ticket || 0).toLocaleString(),
      numPurchases: stats?.num_purchases || 0,
      topProducts: stats?.top_products || "ninguno",
      senderName: settings?.sender_name || "El equipo",
      businessName: settings?.business_name || "Tu negocio",
    };

    // Try Ollama local first
    const clientPrompt = settings?.ai_client_prompt || `Eres un asesor de ventas de Amway. Genera un análisis breve en español para el vendedor sobre este cliente:

Cliente: {{clientName}}
Etapa: {{stage}}
Total facturado: RD\${{totalSpent}}
Deuda pendiente: RD\${{pendingBalance}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Responde SOLO en este formato (máximo 4 líneas):
RESUMEN: [2 oraciones sobre el cliente]
ABORDAJE: [1 sugerencia de cómo contactarlo y qué ofrecerle]`;

    const prompt = fillTemplate(clientPrompt, templateVars);

    const response = await callOllama(prompt);
    if (response) {
      const resumenMatch = response.match(/RESUMEN:\s*(.+)/i);
      const abordajeMatch = response.match(/ABORDAJE:\s*(.+)/i);
      aiSummary = resumenMatch?.[1]?.trim() || "";
      approach = abordajeMatch?.[1]?.trim() || "";
    }

    // Fallback to generated summary
    if (!aiSummary) {
      aiSummary = generarResumen(client, stats);
    }

    return NextResponse.json({ ai_summary: aiSummary, approach });
  } catch {
    console.error("[client-summary] error");
    return NextResponse.json({ error: "Error al generar el resumen" }, { status: 500 });
  }
}