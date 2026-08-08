import { supabase } from "@/lib/supabase";

interface Document {
  id: string;
  type: "Factura" | "Recibo" | "Compra";
  number: string;
  client?: string;
  supplier?: string;
  date: string;
  total: number;
  status: string;
}

export async function getDocuments(): Promise<Document[]> {
  const [invoices, receipts, purchases] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, status, clients(full_name)")
      .not("status", "eq", "CANCELLED")
      .order("invoice_date", { ascending: false }),
    supabase
      .from("receipts")
      .select("id, receipt_number, created_at, amount, payment_method, clients(full_name), invoices!inner(invoice_number)")
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("id, purchase_number, purchase_date, total, status, suppliers(name)")
      .not("status", "eq", "CANCELLED")
      .order("purchase_date", { ascending: false }),
  ]);

  const docs: Document[] = [];

  (invoices.data || []).forEach((inv: unknown) => {
    const i = inv as Record<string, unknown>;
    const clients = i.clients as Record<string, unknown> | null;
    docs.push({
      id: i.id as string,
      type: "Factura",
      number: i.invoice_number as string,
      client: (clients?.full_name as string) || "Sin cliente",
      date: i.invoice_date as string,
      total: Number(i.total),
      status: i.status === "PAID" ? "Pagada" : i.status === "PENDING" ? "Pendiente" : i.status === "PARTIAL" ? "Parcial" : (i.status as string),
    });
  });

  (receipts.data || []).forEach((rec: unknown) => {
    const r = rec as Record<string, unknown>;
    const clients = r.clients as Record<string, unknown> | null;
    const invoices = r.invoices as Record<string, unknown> | null;
    const invClients = invoices?.clients as Record<string, unknown> | null;
    docs.push({
      id: r.id as string,
      type: "Recibo",
      number: r.receipt_number as string,
      client: (clients?.full_name as string) || (invClients?.full_name as string) || "Sin cliente",
      date: (r.created_at as string)?.split("T")[0] || "",
      total: Number(r.amount),
      status: "Emitido",
    });
  });

  (purchases.data || []).forEach((pur: unknown) => {
    const p = pur as Record<string, unknown>;
    const suppliers = p.suppliers as Record<string, unknown> | null;
    docs.push({
      id: p.id as string,
      type: "Compra",
      number: p.purchase_number as string,
      supplier: (suppliers?.name as string) || "Sin proveedor",
      date: p.purchase_date as string,
      total: Number(p.total),
      status: "Registrada",
    });
  });

  return docs.sort((a, b) => b.date.localeCompare(a.date));
}