import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/search";
import type { Client, ClientCardData, ClientTag, ClientTagRelation, ClientType } from "@/types/database";
import { STAGE_MIGRATION_MAP } from "@/lib/pipeline-constants";

export async function getClients() {
  const { data, error } = await supabase.from("clients").select("*").order("full_name");
  if (error) throw error;
  return data as Client[];
}

export async function getClientsWithBalances() {
  const clients = await getClients();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("client_id, balance_due")
    .neq("status", "PAID");
  if (error) throw error;
  const balanceMap: Record<string, number> = {};
  for (const inv of invoices || []) {
    balanceMap[inv.client_id] = (balanceMap[inv.client_id] || 0) + Number(inv.balance_due);
  }
  return clients.map(c => ({ ...c, pending_balance: balanceMap[c.id] || 0 }));
}

export async function getClientCardData(): Promise<ClientCardData[]> {
  const clients = await getClients();

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, client_id, invoice_date, total, status, pv_total")
    .neq("status", "CANCELLED");
  if (invErr) throw invErr;

  const { data: items, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("invoice_id, product_id, quantity, pv, products!inner(name)")
    .in("invoice_id", (invoices || []).map(i => i.id));
  if (itemsErr) throw itemsErr;

  const { data: balanceInvoices, error: balErr } = await supabase
    .from("invoices")
    .select("client_id, balance_due")
    .neq("status", "PAID");
  if (balErr) throw balErr;

  const { data: followups, error: fupErr } = await supabase
    .from("followups")
    .select("client_id, next_followup, comments, status")
    .in("status", ["PENDING", "OVERDUE"])
    .order("next_followup", { ascending: true });
  if (fupErr) throw fupErr;

  const { data: tagRelations, error: tagErr } = await supabase
    .from("client_tag_relations")
    .select("*, client_tags(name)");
  if (tagErr) throw tagErr;

  const balanceMap: Record<string, number> = {};
  for (const inv of balanceInvoices || []) {
    balanceMap[inv.client_id] = (balanceMap[inv.client_id] || 0) + Number(inv.balance_due);
  }

  const invoiceItemsMap: Record<string, Array<{ name: string }>> = {};
  for (const item of items || []) {
    if (!invoiceItemsMap[item.invoice_id]) invoiceItemsMap[item.invoice_id] = [];
    invoiceItemsMap[item.invoice_id].push({ name: (item as any).products?.name || "—" });
  }

  const clientInvoiceMap: Record<string, Array<{ invoice_date: string; total: number; pv_total: number; id: string }>> = {};
  for (const inv of invoices || []) {
    if (!clientInvoiceMap[inv.client_id]) clientInvoiceMap[inv.client_id] = [];
    clientInvoiceMap[inv.client_id].push(inv);
  }

  const tagsByClient: Record<string, { id: string; name: string }[]> = {};
  for (const rel of tagRelations || []) {
    if (!tagsByClient[rel.client_id]) tagsByClient[rel.client_id] = [];
    tagsByClient[rel.client_id].push({ id: rel.tag_id, name: (rel as any).client_tags?.name || "" });
  }

  const nextActionByClient: Record<string, { date: string; description: string }> = {};
  for (const fup of followups || []) {
    if (!nextActionByClient[fup.client_id]) {
      nextActionByClient[fup.client_id] = {
        date: fup.next_followup,
        description: fup.comments?.replace(/^\[.*?\]\s*/, "").substring(0, 60) || "Seguimiento",
      };
    }
  }

  const productCountByClient: Record<string, Record<string, number>> = {};
  const lastPurchaseByProduct: Record<string, Record<string, string>> = {};
  const PRODUCT_CYCLES: Record<string, number> = {
    "Double X": 30, "Proteína Vegetal": 25, "Proteína": 25,
    "Pasta dental": 45, "Glister": 45,
  };

  for (const inv of invoices || []) {
    const invItems = invoiceItemsMap[inv.id] || [];
    for (const item of invItems) {
      if (!productCountByClient[inv.client_id]) productCountByClient[inv.client_id] = {};
      productCountByClient[inv.client_id][item.name] = (productCountByClient[inv.client_id][item.name] || 0) + 1;

      if (!lastPurchaseByProduct[inv.client_id]) lastPurchaseByProduct[inv.client_id] = {};
      const existing = lastPurchaseByProduct[inv.client_id][item.name];
      if (!existing || inv.invoice_date > existing) {
        lastPurchaseByProduct[inv.client_id][item.name] = inv.invoice_date;
      }
    }
  }

  const now = new Date();
  return clients.map(c => {
    const clientInvoices = clientInvoiceMap[c.id] || [];
    const totalSpent = clientInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const numPurchases = clientInvoices.length;
    const dates = clientInvoices.map(i => i.invoice_date).filter(Boolean).sort();
    const lastPurchaseDate = dates.length > 0 ? dates[dates.length - 1] : null;
    const daysSince = lastPurchaseDate
      ? Math.floor((now.getTime() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const pvTotal = clientInvoices.reduce((sum, inv) => sum + Number(inv.pv_total || 0), 0);
    const avgTicket = numPurchases > 0 ? totalSpent / numPurchases : 0;

    const topProducts = Object.entries(productCountByClient[c.id] || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    let repurchaseDate: string | null = null;
    const clientProducts = lastPurchaseByProduct[c.id] || {};
    for (const [productName, lastDate] of Object.entries(clientProducts)) {
      for (const [key, days] of Object.entries(PRODUCT_CYCLES)) {
        if (productName.toLowerCase().includes(key.toLowerCase())) {
          const d = new Date(lastDate);
          d.setDate(d.getDate() + days);
          const est = d.toISOString().split("T")[0];
          if (!repurchaseDate || est < repurchaseDate) repurchaseDate = est;
        }
      }
    }

    return {
      ...c,
      pending_balance: balanceMap[c.id] || 0,
      total_spent: totalSpent,
      num_purchases: numPurchases,
      last_purchase_date: lastPurchaseDate,
      days_since_last_purchase: daysSince,
      avg_ticket: avgTicket,
      pv_total: pvTotal,
      top_products: topProducts,
      tags: tagsByClient[c.id] || [],
      next_action: nextActionByClient[c.id] || null,
      repurchase_date: repurchaseDate,
      days_in_stage: c.stage_entered_at
        ? Math.floor((now.getTime() - new Date(c.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    } as ClientCardData;
  });
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se encontró el cliente");
  return data[0] as Client;
}

export async function createClient(client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").insert(client).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se pudo crear el cliente");
  return data[0] as Client;
}

export async function updateClient(id: string, client: Partial<Client>) {
  const { data, error } = await supabase.from("clients").update(client).eq("id", id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No tienes permiso para editar clientes. Ejecuta el SQL de migración de RLS en Supabase.");
  return data[0] as Client;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function searchClients(query: string) {
  const all = await getClients();
  const q = normalize(query);
  return all.filter(
    (c: Client) =>
      normalize(c.full_name).includes(q) ||
      (c.phone && normalize(c.phone).includes(q)) ||
      (c.email && normalize(c.email).includes(q)) ||
      (c.ibo_number && normalize(c.ibo_number).includes(q))
  );
}

export async function getClientTags() {
  const { data, error } = await supabase.from("client_tags").select("*").order("name");
  if (error) throw error;
  return data as ClientTag[];
}

export async function getClientTagRelations(clientId: string) {
  const { data, error } = await supabase
    .from("client_tag_relations")
    .select("*, client_tags(*)")
    .eq("client_id", clientId);
  if (error) throw error;
  return data;
}

// ── Pipeline: cambiar stage con timestamp ───────────────────────
export async function updateClientStage(
  clientId: string,
  newStage: string,
  extra?: { qualification_level?: string; closure_result?: string }
) {
  const updates: Record<string, any> = {
    stage: newStage,
    stage_entered_at: new Date().toISOString(),
  };
  if (extra?.qualification_level !== undefined) updates.qualification_level = extra.qualification_level;
  if (extra?.closure_result !== undefined) updates.closure_result = extra.closure_result;
  const { data, error } = await supabase.from("clients").update(updates).eq("id", clientId).select();
  if (error) throw error;
  return data?.[0] as Client;
}

// ── Migrar stages antiguos a nuevos ────────────────────────────
export async function migrateStages() {
  const clients = await getClients();
  let migrated = 0;
  for (const c of clients) {
    const newStage = STAGE_MIGRATION_MAP[c.stage];
    if (newStage && newStage !== c.stage) {
      await supabase.from("clients").update({
        stage: newStage,
        client_type: "comprador",
        stage_entered_at: c.created_at,
      }).eq("id", c.id);
      migrated++;
    }
    // Si el stage no está en el mapa (ya es un stage nuevo), no hacer nada
  }
  return migrated;
}
