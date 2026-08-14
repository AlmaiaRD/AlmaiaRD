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
    .select("*, clients(id, full_name, phone, email)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*, products(id, name, code)")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });
  if (itemsError) throw itemsError;

  return { quote: quote as QuoteWithClient, items: items as QuoteItemWithProduct[] };
}

export async function getClientQuotes(clientId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("client_id", clientId)
    .order("quote_date", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getNextQuoteNumber() {
  const settings = await getSettings().catch(() => null);
  const prefix = settings?.quote_prefix || "COT-";

  const { data: lastQuote } = await supabase
    .from("quotes")
    .select("quote_number")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastNum = lastQuote?.[0]?.quote_number || `${prefix}000000`;
  const numPart = parseInt(lastNum.replace(prefix, ""), 10);
  const nextNum = isNaN(numPart) ? 1 : numPart + 1;
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

export async function createQuote(data: QuoteInput) {
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const quoteNumber = await getNextQuoteNumber();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
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
      margin: data.margin ?? null,
      sent_at: data.status === "SENT" ? new Date().toISOString() : null,
      created_by: userId,
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
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

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
    margin: data.margin ?? null,
    updated_by: userId,
  };
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
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const patch: Record<string, unknown> = { status, updated_by: userId };
  if (status === "SENT") patch.sent_at = new Date().toISOString();

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
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData.session?.user?.id;

  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "CONVERTED", converted_invoice_id: invoiceId, updated_by: userId })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}
