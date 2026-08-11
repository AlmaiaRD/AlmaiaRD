import { supabase } from "@/lib/supabase";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import { addInventoryStock } from "./inventory";
import { getBundleComponentMap } from "./products";
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

  invalidateCache("next_return_number");
  const { error: itemsError } = await supabase
    .from("return_items")
    .insert(returnItems);

  if (itemsError) throw itemsError;

  return data as Return;
}

export async function completeReturn(id: string) {
  // Idempotente: si ya está COMPLETADA no se vuelve a ajustar el inventario
  // (evita reponer stock dos veces al reintentar).
  const { data: current } = await supabase
    .from("returns")
    .select("status")
    .eq("id", id)
    .single();
  if (current?.status === "COMPLETED") return current as Return;

  const { data: items } = await supabase
    .from("return_items")
    .select("product_id, quantity, line_total")
    .eq("return_id", id);

  const { data, error } = await supabase
    .from("returns")
    .update({ status: "COMPLETED" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Repone el inventario de los productos devueltos; los bundles devuelven
  // el stock de cada componente multiplicado por la cantidad.
  if (items && items.length > 0) {
    const ids = [...new Set(items.map(i => i.product_id).filter(Boolean) as string[])];
    const compMap = ids.length > 0 ? await getBundleComponentMap(ids) : new Map<string, any[]>();
    for (const item of items) {
      if (!item.product_id) continue;
      const comps = compMap.get(item.product_id);
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;
      if (comps && comps.length > 0) {
        for (const c of comps) {
          await addInventoryStock(c.product_id, qty * c.quantity, 0, 0, "RETURN", "return", id);
        }
      } else {
        await addInventoryStock(item.product_id, qty, 0, Number(item.line_total || 0), "RETURN", "return", id);
      }
    }
  }

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
