import { supabase } from "@/lib/supabase";

export interface RiskScore {
  clientId: string;
  score: number; // 0-100, higher = riskier
  level: "low" | "medium" | "high";
  factors: { label: string; impact: number }[];
}

const RISK_WEIGHTS = {
  debt_ratio: 35,
  payment_delay: 25,
  inactivity: 20,
  low_frequency: 10,
  low_ticket: 10,
};

export async function calculateRiskScore(clientId: string): Promise<RiskScore> {
  const factors: { label: string; impact: number }[] = [];
  let totalScore = 0;

  // 1. Debt ratio — balance_due / total
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, balance_due, status, invoice_date, amount_paid")
    .eq("client_id", clientId)
    .neq("status", "CANCELLED")
    .order("invoice_date", { ascending: false });

  if (!invoices || invoices.length === 0) {
    return { clientId, score: 50, level: "medium", factors: [{ label: "Sin historial de compras", impact: 50 }] };
  }

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalDue = invoices.reduce((s, i) => s + Number(i.balance_due), 0);

  if (totalBilled > 0) {
    const debtRatio = totalDue / totalBilled;
    const debtScore = Math.min(100, Math.round(debtRatio * 100));
    const weighted = Math.round(debtScore * (RISK_WEIGHTS.debt_ratio / 100));
    totalScore += weighted;
    if (debtRatio > 0) {
      factors.push({ label: `Deuda: RD$${totalDue.toLocaleString()} de RD$${totalBilled.toLocaleString()}`, impact: weighted });
    }
  }

  // 2. Payment delay — invoices paid late or still pending older than 30 days
  const unpaidOld = invoices.filter(i => i.status !== "PAID" && i.status !== "CANCELLED");
  const oldPending = unpaidOld.filter(i => {
    const days = Math.floor((new Date().getTime() - new Date(i.invoice_date).getTime()) / (1000 * 60 * 60 * 24));
    return days > 30;
  });
  if (oldPending.length > 0) {
    const delayScore = Math.min(100, oldPending.length * 25);
    const weighted = Math.round(delayScore * (RISK_WEIGHTS.payment_delay / 100));
    totalScore += weighted;
    factors.push({ label: `${oldPending.length} factura(s) vencidas (+30 días)`, impact: weighted });
  }

  // 3. Inactivity — no purchases in last 90 days
  const paidInvoices = invoices.filter(i => i.status === "PAID");
  if (paidInvoices.length > 0) {
    const lastDate = new Date(paidInvoices[0].invoice_date);
    const daysSince = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 90) {
      const inactScore = Math.min(100, Math.round((daysSince / 365) * 100));
      const weighted = Math.round(inactScore * (RISK_WEIGHTS.inactivity / 100));
      totalScore += weighted;
      factors.push({ label: `${daysSince} días sin comprar`, impact: weighted });
    }
  } else if (invoices.length > 0) {
    // Has invoices but none paid
    totalScore += RISK_WEIGHTS.inactivity;
    factors.push({ label: "Ninguna factura pagada", impact: RISK_WEIGHTS.inactivity });
  }

  // 4. Low frequency — only 1-2 purchases total
  if (paidInvoices.length <= 2) {
    const freqScore = paidInvoices.length === 0 ? 100 : paidInvoices.length === 1 ? 60 : 30;
    const weighted = Math.round(freqScore * (RISK_WEIGHTS.low_frequency / 100));
    totalScore += weighted;
    factors.push({ label: `Solo ${paidInvoices.length} compra(s) realizada(s)`, impact: weighted });
  }

  // 5. Low average ticket
  if (paidInvoices.length > 0) {
    const avgTicket = totalBilled / paidInvoices.length;
    if (avgTicket < 1000) {
      const ticketScore = Math.round((1 - avgTicket / 1000) * 100);
      const weighted = Math.round(ticketScore * (RISK_WEIGHTS.low_ticket / 100));
      totalScore += weighted;
      factors.push({ label: `Ticket promedio bajo: RD$${Math.round(avgTicket).toLocaleString()}`, impact: weighted });
    }
  }

  const score = Math.min(100, totalScore);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  return { clientId, score, level, factors };
}

export async function getCrossSellProducts(productId: string, topN = 5): Promise<{ product_id: string; product_name: string; code: string; frequency: number }[]> {
  // Find invoices containing this product
  const { data: invoiceItems } = await supabase
    .from("invoice_items")
    .select("invoice_id")
    .eq("product_id", productId);

  if (!invoiceItems || invoiceItems.length === 0) return [];

  const invoiceIds = [...new Set(invoiceItems.map(i => i.invoice_id))];

  // Find other products in same invoices
  const { data: siblings } = await supabase
    .from("invoice_items")
    .select("product_id, products!inner(name, code)")
    .in("invoice_id", invoiceIds)
    .neq("product_id", productId);

  if (!siblings) return [];

  // Count frequency
  const freqMap = new Map<string, { product_id: string; product_name: string; code: string; count: number }>();
  for (const s of siblings) {
    const pid = s.product_id;
    if (!freqMap.has(pid)) {
      freqMap.set(pid, {
        product_id: pid,
        product_name: (s as any).products?.name || "",
        code: (s as any).products?.code || "",
        count: 0,
      });
    }
    freqMap.get(pid)!.count++;
  }

  return [...freqMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      code: item.code,
      frequency: Math.round((item.count / invoiceIds.length) * 100),
    }));
}

export async function getClientSummary(clientId: string) {
  const { data: client } = await supabase
    .from("clients")
    .select("full_name, phone, email, stage, created_at, notes")
    .eq("id", clientId)
    .single();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_number, invoice_date, total, status")
    .eq("client_id", clientId)
    .order("invoice_date", { ascending: false })
    .limit(20);

  const { data: items } = await supabase
    .from("invoice_items")
    .select("products(name, code, subbrands(name)), quantity, line_total, invoice_id, invoices!inner(status)")
    .eq("invoices.client_id", clientId)
    .eq("invoices.status", "PAID")
    .order("invoices.invoice_date", { ascending: false })
    .limit(30);

  const totalSpent = (invoices || []).reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = (invoices || []).filter(i => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0);
  const totalPending = (invoices || []).filter(i => i.status !== "PAID" && i.status !== "CANCELLED").length;

  const productCount: Record<string, { name: string; subbrand: string; count: number }> = {};
  for (const it of items || []) {
    const name = (it as any).products?.name || "Producto";
    const subbrand = (it as any).products?.subbrands?.name || "";
    if (!productCount[name]) productCount[name] = { name, subbrand, count: 0 };
    productCount[name].count += it.quantity;
  }

  const topProducts = Object.values(productCount).sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    client: client ? { name: client.full_name, phone: client.phone, email: client.email, stage: client.stage, created_at: client.created_at, notes: client.notes } : null,
    stats: {
      total_invoices: invoices?.length || 0,
      total_spent: totalSpent,
      total_paid: totalPaid,
      pending_count: totalPending,
      avg_ticket: invoices && invoices.length > 0 ? Math.round(totalSpent / invoices.length) : 0,
      top_products: topProducts,
    },
  };
}
