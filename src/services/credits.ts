import { supabase } from "@/lib/supabase";
import type { CreditBalance } from "@/types/database";

export async function getClientCredits(clientId: string) {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("*, receipts(receipt_number, receipt_date)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (CreditBalance & { receipts: { receipt_number: string; receipt_date: string } | null })[];
}

export async function createCreditBalance(credit: Partial<CreditBalance>) {
  const { data, error } = await supabase
    .from("credit_balances")
    .insert(credit)
    .select()
    .single();
  if (error) throw error;
  return data as CreditBalance;
}

export async function useCreditBalance(creditId: string, amount: number) {
  const { data, error } = await supabase.rpc("use_credit_balance", {
    p_credit_id: creditId,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function getCreditsSummary() {
  const { data: active, error: activeError } = await supabase
    .from("credit_balances")
    .select("*, clients(full_name, phone)")
    .eq("status", "AVAILABLE")
    .order("created_at", { ascending: false });
  if (activeError) throw activeError;

  const { data: totals, error: totalsError } = await supabase
    .from("credit_balances")
    .select("amount, status");
  if (totalsError) throw totalsError;

  const totalAvailable = totals
    .filter((c: any) => c.status === "AVAILABLE")
    .reduce((s: number, c: any) => s + Number(c.amount), 0);

  return { active: active, totalAvailable };
}
