import { NextRequest, NextResponse } from "next/server";
import { ITBIS_RATE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, discount_amount, margin } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos un producto" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
      }
      if (!item.unit_price || item.unit_price < 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }
    }

    const subtotal = items.reduce(
      (s: number, i: any) => s + (i.quantity || 0) * Number(i.unit_price || 0),
      0
    );

    const discount = Number(discount_amount || 0);
    if (discount < 0 || discount > subtotal) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const itbisTotal = items.reduce(
      (s: number, i: any) =>
        s + (i.itbis ? 1 : 0) * (i.quantity || 0) * Number(i.unit_price || 0) * ITBIS_RATE,
      0
    );

    const total = subtotal + itbisTotal - discount;
    const pvTotal = items.reduce((s: number, i: any) => s + (i.pv || 0) * (i.quantity || 0), 0);

    return NextResponse.json({
      valid: true,
      subtotal: Math.round(subtotal * 100) / 100,
      itbis_total: Math.round(itbisTotal * 100) / 100,
      discount_amount: discount,
      total: Math.round(total * 100) / 100,
      pv_total: pvTotal,
    });
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
}
