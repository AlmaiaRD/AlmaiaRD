-- =============================================
-- MIGRACIÓN: Pipeline + Auditoría Almaia RD
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Columnas faltantes en clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'comprador';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qualification_level TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS closure_result TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT now();

-- 2. Columnas faltantes en credit_balances
ALTER TABLE credit_balances ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2);
ALTER TABLE credit_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill balance desde amount
UPDATE credit_balances SET balance = amount WHERE balance IS NULL;

-- 3. Fix RPC use_credit_balance
CREATE OR REPLACE FUNCTION use_credit_balance(p_credit_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_balances
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_credit_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado o saldo insuficiente';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. DELETE policy para invoice_items
CREATE POLICY "invoice_items_delete" ON invoice_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- 5. DELETE policy para inventory_movements (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'inventory_movements_delete' AND tablename = 'inventory_movements'
  ) THEN
    CREATE POLICY "inventory_movements_delete" ON inventory_movements
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
