import { NextRequest, NextResponse } from "next/server";

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 600 },
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
    const { rotationData } = await req.json();
    if (!rotationData || !Array.isArray(rotationData) || rotationData.length === 0) {
      return NextResponse.json({ error: "Datos de rotación requeridos" }, { status: 400 });
    }

    const total = rotationData.length;
    const alta = rotationData.filter((d: any) => d.diasEnInventario < 15 && d.diasEnInventario < 999).length;
    const media = rotationData.filter((d: any) => d.diasEnInventario >= 15 && d.diasEnInventario <= 60).length;
    const baja = rotationData.filter((d: any) => d.diasEnInventario > 60 && d.diasEnInventario < 999).length;
    const sinMov = rotationData.filter((d: any) => d.diasEnInventario >= 999).length;
    const capitalInmovilizado = rotationData
      .filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999)
      .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0);
    const bajoRotacion = rotationData
      .filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999)
      .map((d: any) => d.name)
      .slice(0, 5)
      .join(", ");
    const proyStockout = rotationData.filter((d: any) => {
      if (d.sold <= 0 || d.stock <= 0 || !d.velocidadDias) return false;
      return Math.round(d.velocidadDias * d.stock) < 30;
    }).length;

    const prompt = `Eres un analista de inventario. Analiza estos datos de rotación de inventario y genera recomendaciones en español (máximo 6 líneas):

Resumen del inventario:
- Total productos: ${total}
- Rotación alta (< 15 días): ${alta}
- Rotación media (15-60 días): ${media}
- Rotación baja (> 60 días): ${baja}
- Sin movimientos: ${sinMov}
- Capital inmovilizado (> 90 días): RD$${capitalInmovilizado.toLocaleString()}
- Productos con rotación baja: ${bajoRotacion || "ninguno"}
- Productos próximos a agotarse (< 30 días): ${proyStockout}

Da recomendaciones accionables sobre qué productos liquidar, cuáles reponer, y cómo mejorar la rotación general. Responde en español claro y directo.`;

    let analysis = await callOllama(prompt);

    if (!analysis) {
      const parts: string[] = [];
      parts.push("Resumen de rotación de inventario:");
      parts.push(`• ${alta} productos tienen rotación alta (menos de 15 días).`);
      parts.push(`• ${media} productos tienen rotación media (15-60 días).`);
      parts.push(`• ${baja} productos tienen rotación baja (más de 60 días).`);
      parts.push(`• ${sinMov} productos no tienen movimientos registrados.`);
      parts.push("");
      if (bajoRotacion) {
        parts.push(`⚠️ Productos con baja rotación (>90 días): ${bajoRotacion}. Considera aplicar ofertas o liquidación.`);
      }
      if (proyStockout > 0) {
        parts.push(`⚠️ ${proyStockout} productos están próximos a agotarse — revisa sus niveles de reorden.`);
      }
      if (capitalInmovilizado > 0) {
        parts.push(`💰 Capital inmovilizado en productos >90 días: RD$${capitalInmovilizado.toLocaleString()}. Libera capital liquidando estos productos.`);
      }
      analysis = parts.join("\n");
    }

    return NextResponse.json({ analysis });
  } catch (err: any) {
    console.error("[inventory-analysis]", err);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
