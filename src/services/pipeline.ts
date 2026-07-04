import { supabase } from "@/lib/supabase";
import { getLocalDateString } from "@/lib/utils";

const VIP_THRESHOLD = 50000;
const INACTIVE_DAYS = 90;
const PRODUCT_CYCLES: Record<string, number> = {
  "Double X": 30,
  "Proteína Vegetal": 25,
  "Proteína": 25,
  "Pasta dental": 45,
  "Glister": 45,
};

// Auto-progresión: al crear primera factura → Cierre (Ganado)
export async function updateStageOnFirstPurchase(clientId: string) {
  if (!clientId) return;

  const { data: client } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .single();
  if (!client) return;

  // Solo mover si está en etapa de pipeline (pre-venta)
  const preSaleStages = ["prospecto", "calificacion", "contacto_inicial", "propuesta", "negociacion"];
  if (!preSaleStages.includes(client.stage)) return;

  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .neq("status", "CANCELLED");

  if (count === 1) {
    await supabase.from("clients").update({
      stage: "cierre",
      closure_result: "ganado",
      stage_entered_at: new Date().toISOString(),
      first_contact_date: getLocalDateString(),
    }).eq("id", clientId);
  }
}

// Auto-progresión: al recibir pago
export async function updateStageOnPayment(clientId: string) {
  if (!clientId) return;

  const { data: paidInvoices } = await supabase
    .from("invoices")
    .select("id, status, total")
    .eq("client_id", clientId)
    .eq("status", "PAID");

  const paidCount = paidInvoices?.length || 0;

  // Solo mover a cierre si tiene 3+ pagos
  const { data: client } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .single();
  if (!client) return;

  const preSaleStages = ["prospecto", "calificacion", "contacto_inicial", "propuesta", "negociacion"];
  if (preSaleStages.includes(client.stage) && paidCount >= 3) {
    await supabase.from("clients").update({
      stage: "cierre",
      closure_result: "ganado",
      stage_entered_at: new Date().toISOString(),
      last_contact_date: getLocalDateString(),
    }).eq("id", clientId);
  }
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
  const { data: clients } = await supabase.from("clients").select("id, full_name, stage").neq("stage", "cierre");
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
    .select("products(name, duracion_dias), invoice_id, invoices!inner(invoice_date, client_id)")
    .eq("invoices.client_id", clientId)
    .neq("invoices.status", "CANCELLED")
    .order("invoices.invoice_date", { ascending: false })
    .limit(10);

  if (!items || items.length === 0) return null;

  for (const item of items) {
    const product = (item as any).products;
    const productName = product?.name || "";
    const duration = product?.duracion_dias;
    
    if (duration && duration > 0) {
      const lastDate = new Date((item as any).invoices?.invoice_date);
      lastDate.setDate(lastDate.getDate() + duration);
      return lastDate.toISOString().split("T")[0];
    }
    
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

  if (client.stage === "cierre") {
    const isInactive = await checkInactiveStatus(clientId);
    if (isInactive) {
      return { current: client.stage, suggested: "prospecto", reason: `Más de ${INACTIVE_DAYS} días sin comprar — reiniciar ciclo` };
    }
  }

  return null;
}
