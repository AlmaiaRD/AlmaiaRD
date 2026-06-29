import { supabase } from "@/lib/supabase";

const VIP_THRESHOLD = 50000;
const INACTIVE_DAYS = 90;
const PRODUCT_CYCLES: Record<string, number> = {
  "Double X": 30,
  "Proteína Vegetal": 25,
  "Proteína": 25,
  "Pasta dental": 45,
  "Glister": 45,
};

export async function updateStageOnFirstPurchase(clientId: string) {
  if (!clientId) return;

  const { data: client } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .single();
  if (!client) return;
  if (client.stage !== "lead" && client.stage !== "contacted" && client.stage !== "quote") return;

  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .neq("status", "CANCELLED");

  if (count === 1) {
    await supabase.from("clients").update({
      stage: "first_purchase",
      first_contact_date: new Date().toISOString().split("T")[0],
    }).eq("id", clientId);
  }
}

export async function updateStageOnPayment(clientId: string) {
  if (!clientId) return;

  const { data: paidInvoices } = await supabase
    .from("invoices")
    .select("id, status, total")
    .eq("client_id", clientId)
    .eq("status", "PAID");

  const paidCount = paidInvoices?.length || 0;

  let newStage = "post_sale";
  if (paidCount >= 3) {
    newStage = "active";
  }

  // Check VIP eligibility
  const totalSpent = (paidInvoices || []).reduce((s, inv) => s + Number(inv.total), 0);
  if (totalSpent >= VIP_THRESHOLD) {
    newStage = "vip";
  }

  const { data: client } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .single();
  if (!client) return;

  const currentStageIndex = stageIndex(client.stage);
  const newStageIndex = stageIndex(newStage);

  if (newStageIndex > currentStageIndex) {
    await supabase.from("clients").update({
      stage: newStage,
      last_contact_date: new Date().toISOString().split("T")[0],
    }).eq("id", clientId);
  }
}

function stageIndex(stage: string): number {
  const order = ["lead", "contacted", "quote", "first_purchase", "post_sale", "active", "repurchase", "vip", "inactive"];
  return order.indexOf(stage);
}

export async function checkVipEligibility(clientId: string): Promise<boolean> {
  const { data: paidInvoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("client_id", clientId)
    .eq("status", "PAID");

  const total = (paidInvoices || []).reduce((s, inv) => s + Number(inv.total), 0);
  return total >= VIP_THRESHOLD;
}

export async function checkInactiveStatus(clientId: string): Promise<boolean> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_date")
    .eq("client_id", clientId)
    .neq("status", "CANCELLED")
    .order("invoice_date", { ascending: false })
    .limit(1);

  if (!invoices || invoices.length === 0) return false;

  const lastDate = new Date(invoices[0].invoice_date);
  const daysSince = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= INACTIVE_DAYS;
}

export async function getInactiveCandidates() {
  const { data: clients } = await supabase.from("clients").select("id, full_name, stage").neq("stage", "inactive");
  if (!clients) return [];

  const inactive: { id: string; full_name: string; days_since: number }[] = [];

  for (const client of clients) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("invoice_date")
      .eq("client_id", client.id)
      .neq("status", "CANCELLED")
      .order("invoice_date", { ascending: false })
      .limit(1);

    if (invoices && invoices.length > 0) {
      const daysSince = Math.floor((new Date().getTime() - new Date(invoices[0].invoice_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= INACTIVE_DAYS) {
        inactive.push({ id: client.id, full_name: client.full_name, days_since: daysSince });
      }
    }
  }

  return inactive;
}

export async function calculateRepurchaseDate(clientId: string): Promise<string | null> {
  const { data: items } = await supabase
    .from("invoice_items")
    .select("products(name), invoice_id, invoices!inner(invoice_date, client_id)")
    .eq("invoices.client_id", clientId)
    .neq("invoices.status", "CANCELLED")
    .order("invoices.invoice_date", { ascending: false })
    .limit(10);

  if (!items || items.length === 0) return null;

  for (const item of items) {
    const productName = (item as any).products?.name || "";
    const cycle = Object.entries(PRODUCT_CYCLES).find(([key]) =>
      productName.toLowerCase().includes(key.toLowerCase())
    );
    if (cycle) {
      const lastDate = new Date((item as any).invoices?.invoice_date);
      lastDate.setDate(lastDate.getDate() + cycle[1]);
      return lastDate.toISOString().split("T")[0];
    }
  }

  return null;
}

export async function autoSuggestStageUpdate(clientId: string): Promise<{ current: string; suggested: string; reason: string } | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .single();
  if (!client) return null;

  if (client.stage === "active" || client.stage === "vip") {
    const isInactive = await checkInactiveStatus(clientId);
    if (isInactive) {
      return { current: client.stage, suggested: "inactive", reason: `Más de ${INACTIVE_DAYS} días sin comprar` };
    }
  }

  if (client.stage !== "vip") {
    const isVip = await checkVipEligibility(clientId);
    if (isVip) {
      return { current: client.stage, suggested: "vip", reason: `Superó RD$${VIP_THRESHOLD.toLocaleString()} en compras` };
    }
  }

  return null;
}
