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

  (invoices.data || []).forEach((inv: any) => {
    docs.push({
      id: inv.id,
      type: "Factura",
      number: inv.invoice_number,
      client: inv.clients?.full_name || "Sin cliente",
      date: inv.invoice_date,
      total: Number(inv.total),
      status: inv.status === "PAID" ? "Pagada" : inv.status === "PENDING" ? "Pendiente" : inv.status === "PARTIAL" ? "Parcial" : inv.status,
    });
  });

  (receipts.data || []).forEach((rec: any) => {
    docs.push({
      id: rec.id,
      type: "Recibo",
      number: rec.receipt_number,
      client: rec.clients?.full_name || rec.invoices?.clients?.full_name || "Sin cliente",
      date: rec.created_at?.split("T")[0] || "",
      total: Number(rec.amount),
      status: "Emitido",
    });
  });

  (purchases.data || []).forEach((pur: any) => {
    docs.push({
      id: pur.id,
      type: "Compra",
      number: pur.purchase_number,
      supplier: pur.suppliers?.name || "Sin proveedor",
      date: pur.purchase_date,
      total: Number(pur.total),
      status: "Registrada",
    });
  });

  return docs.sort((a, b) => b.date.localeCompare(a.date));
}