import { supabase } from "@/lib/supabase";
import { getSettings } from "@/services/settings";
import type { Quote, QuoteItem, QuoteStatus } from "@/types/database";
import { round2 } from "@/lib/invoiceMath";

export type QuoteWithClient = Quote & { clients?: { id: string; full_name: string; phone?: string; email?: string } };
export type QuoteItemWithProduct = QuoteItem & { products?: { id: string; name: string; code?: string } };

export interface QuoteInputItem {
  product_id?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  pv: number;
  itbis: boolean;
  itbis_amount: number;
  custom_name?: string;
}

export interface QuoteInput {
  client_id: string;
  quote_date: string;
  valid_until: string;
  status: QuoteStatus;
  subtotal: number;
  discount_amount: number;
  itbis_total: number;
  total: number;
  pv_total: number;
  notes?: string;
  margin?: number;
  created_by?: string | null;
  updated_by?: string | null;
  items: QuoteInputItem[];
}

export async function getQuotes() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, clients(id, full_name, phone, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as QuoteWithClient[];
}

export async function getQuote(id: string) {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*, products(id, name, code)")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });
  if (itemsError) throw itemsError;

  const mappedItems = (items || []).map((i: any) => ({
    id: i.id,
    quote_id: i.quote_id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost,
    pv: i.pv,
    line_total: i.line_total,
    itbis: i.itbis,
    itbis_amount: i.itbis_amount,
    custom_name: i.custom_name,
    products: i.products ? { id: i.products.id, name: i.products.name, code: i.products.code } : { id: "", name: "", code: "" }
  }));

  return { quote: quote as QuoteWithClient, items: mappedItems as QuoteItemWithProduct[] };
}

export async function getClientQuotes(clientId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, clients(id, full_name, phone, email)")
    .eq("client_id", clientId)
    .order("quote_date", { ascending: false });
  if (error) throw error;
  return data as QuoteWithClient[];
}

export async function getNextQuoteNumber() {
  const settings = await getSettings().catch(() => null);
  const prefix = settings?.quote_prefix || "COT-";

  const { data: num, error } = await supabase
    .rpc("get_next_quote_number", { p_prefix: prefix });

  if (error) throw error;
  return num as string;
}

export async function createQuote(data: QuoteInput) {
  // Validación defensiva: asegurar valores numéricos
  const safeSubtotal = Number(data.subtotal) || 0;
  const safeDiscount = Number(data.discount_amount) || 0;
  const safeItbis = Number(data.itbis_total) || 0;
  const safeTotal = Number(data.total) || 0;
  const safePvTotal = Number(data.pv_total) || 0;
  const safeMargin = Number(data.margin) || 0;

  const quoteNumber = await getNextQuoteNumber().catch(() => null);
  if (!quoteNumber) throw new Error("No se pudo generar el número de cotización. Verifica que la función get_next_quote_number exista en Supabase.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      client_id: String(data.client_id),
      quote_date: String(data.quote_date),
      valid_until: String(data.valid_until),
      status: data.status,
      subtotal: safeSubtotal,
      discount_amount: safeDiscount,
      itbis_total: safeItbis,
      total: safeTotal,
      pv_total: safePvTotal,
      notes: data.notes || null,
      margin: safeMargin,
      sent_at: data.status === "SENT" ? new Date().toISOString() : null,
      created_by: data.created_by || null,
    })
    .select()
    .single();
  if (quoteError) throw quoteError;

  const items = data.items.map((item) => ({
    quote_id: quote.id,
    product_id: item.product_id || null,
    quantity: Number(item.quantity) || 0,
    unit_price: round2(Number(item.unit_price) || 0),
    unit_cost: round2(Number(item.unit_cost) || 0),
    pv: round2(Number(item.pv) || 0),
    line_total: round2((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)),
    itbis: Boolean(item.itbis),
    itbis_amount: round2(Number(item.itbis_amount) || 0),
    custom_name: item.custom_name || null,
  }));

  const { error: itemsError } = await supabase.from("quote_items").insert(items);
  if (itemsError) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    throw itemsError;
  }

  return quote as Quote;
}

export async function updateQuote(id: string, data: QuoteInput) {
  const patch: Record<string, unknown> = {
    client_id: data.client_id,
    quote_date: data.quote_date,
    valid_until: data.valid_until,
    status: data.status,
    subtotal: data.subtotal,
    discount_amount: data.discount_amount,
    itbis_total: data.itbis_total,
    total: data.total,
    pv_total: data.pv_total,
    notes: data.notes || null,
    margin: data.margin ?? 30,
    updated_by: data.updated_by || null,
  } as Record<string, unknown>;
  if (data.status === "SENT") patch.sent_at = new Date().toISOString();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (quoteError) throw quoteError;

  const { error: delError } = await supabase.from("quote_items").delete().eq("quote_id", id);
  if (delError) throw delError;

  const items = data.items.map((item) => ({
    quote_id: id,
    product_id: item.product_id || null,
    quantity: Number(item.quantity) || 0,
    unit_price: round2(Number(item.unit_price) || 0),
    unit_cost: round2(Number(item.unit_cost) || 0),
    pv: round2(Number(item.pv) || 0),
    line_total: round2((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)),
    itbis: Boolean(item.itbis),
    itbis_amount: round2(Number(item.itbis_amount) || 0),
    custom_name: item.custom_name || null,
  }));

  const { error: itemsError } = await supabase.from("quote_items").insert(items);
  if (itemsError) throw itemsError;

  return quote as Quote;
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "SENT") {
    patch.sent_at = new Date().toISOString();
  } else if (status === "DRAFT") {
    patch.sent_at = null;
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}

export async function deleteQuote(id: string) {
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw error;
}

export async function markQuoteConverted(id: string, invoiceId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "CONVERTED", converted_invoice_id: invoiceId })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}
