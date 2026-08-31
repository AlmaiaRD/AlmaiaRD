import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { computeInvoiceMath } from "@/lib/invoiceMath";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const cookieStore = await cookies();
  const authSupabase = createServerClient(supabaseUrl!, anonKey!, {
    cookies: { get(name: string) { return cookieStore.get(name)?.value } }
  });
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { items, discount_amount } = body;

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

    const discount = Number(discount_amount || 0);
    if (discount < 0 || discount > 5000000) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const math = computeInvoiceMath(items.map((i: any) => ({ quantity: i.quantity || 0, unit_price: Number(i.unit_price || 0), cost: Number(i.cost || 0), itbis: !!i.itbis })), discount);

    if (discount > math.subtotal) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const pvTotal = items.reduce((s: number, i: any) => s + (i.pv || 0) * (i.quantity || 0), 0);

    return NextResponse.json({
      valid: true,
      subtotal: math.subtotal,
      itbis_total: math.itbis_total,
      discount_amount: math.discount,
      rounding: math.rounding,
      total: math.total,
      pv_total: pvTotal,
    });
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
}
