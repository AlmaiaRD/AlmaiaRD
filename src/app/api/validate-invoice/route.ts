import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { validateBody } from "@/lib/validation";
import { z } from "zod";
import { computeInvoiceMath } from "@/lib/invoiceMath";

const validateInvoiceSchema = z.object({
  items: z.array(
    z.object({
      quantity: z.number().int().min(1).max(1000),
      unit_price: z.number().min(0).max(1000000),
      cost: z.number().min(0).max(1000000).optional(),
      itbis: z.boolean().optional(),
      pv: z.number().min(0).optional(),
    })
  ).min(1),
  discount_amount: z.number().min(0).max(5000000).optional(),
});

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
    const body = await validateBody(validateInvoiceSchema)(req);
    const { items, discount_amount } = body;

    const discount = Number(discount_amount || 0);
    if (discount < 0 || discount > 5000000) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const math = computeInvoiceMath(items.map((i) => ({
      quantity: i.quantity,
      unit_price: i.unit_price,
      cost: i.cost || 0,
      itbis: i.itbis ?? true,
    })), discount);

    if (discount > math.subtotal) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const pvTotal = items.reduce((s, i) => s + (i.pv || 0) * i.quantity, 0);

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