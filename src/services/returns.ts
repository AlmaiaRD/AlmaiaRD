import { supabase } from "@/lib/supabase";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import type { Return, ReturnItem } from "@/types/database";

export async function getReturns() {
  const { data, error } = await supabase
    .from("returns")
    .select("*, clients(full_name), invoices(invoice_number)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getReturn(id: string) {
  const { data, error } = await supabase
    .from("returns")
    .select("*, clients(full_name), invoices(invoice_number)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getReturnItems(returnId: string) {
  const { data, error } = await supabase
    .from("return_items")
    .select("*, products(name, code)")
    .eq("return_id", returnId);
  if (error) throw error;
  return data;
}

export async function getNextReturnNumber() {
  const cached = getCached<string>("next_return_number");
  if (cached) return cached;

  const { data, error } = await supabase
    .from("returns")
    .select("return_number")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const lastNum = data?.[0]?.return_number || "DEV-000000";
  const num = parseInt(lastNum.replace("DEV-", ""), 10) + 1;
  const next = `DEV-${String(num).padStart(6, "0")}`;
  setCache("next_return_number", next, 30_000);
  return next;
}

export async function createReturn(
  ret: Partial<Return>,
  items: Partial<ReturnItem>[]
) {
  const returnNumber = await getNextReturnNumber();

  const { data, error } = await supabase
    .from("returns")
    .insert({ ...ret, return_number: returnNumber })
    .select()
    .single();

  if (error) throw error;

  const returnItems = items.map((item) => ({
    return_id: data.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    reason: item.reason || null,
  }));

  const { error: itemsError } = await supabase
    .from("return_items")
    .insert(returnItems);

  if (itemsError) throw itemsError;

  invalidateCache("next_return_number");
  return data as Return;
}

export async function completeReturn(id: string) {
  const { data, error } = await supabase
    .from("returns")
    .update({ status: "COMPLETED" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Return;
}

export async function cancelReturn(id: string) {
  const { data, error } = await supabase
    .from("returns")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Return;
}
