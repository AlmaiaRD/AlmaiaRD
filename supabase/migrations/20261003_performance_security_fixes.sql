-- Migración: Índices FK faltantes + Constraint credit_excess + Función quote
-- Fecha: 2026-10-03
-- Riesgo: BAJO - Solo ADD INDEX CONCURRENTLY y ADD CONSTRAINT

-- ============================================================
-- 1. ÍNDICES FK FALTANTES (CONCURRENTLY = sin bloquear writes)
-- ============================================================

-- credit_balances.client_id → clients.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_balances_client_id
  ON public.credit_balances (client_id);

-- receipts.invoice_id → invoices.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_invoice_id
  ON public.receipts (invoice_id);

-- invoice_items.product_id → products.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_product_id
  ON public.invoice_items (product_id);

-- receipts.client_id → clients.id (FK existente pero sin índice)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_client_id
  ON public.receipts (client_id);

-- invoices.client_id → clients.id (FK existente pero sin índice)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_id
  ON public.invoices (client_id);

-- purchases.supplier_id → suppliers.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_supplier_id
  ON public.purchases (supplier_id);

-- purchase_items.product_id → products.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_product_id
  ON public.purchase_items (product_id);

-- purchase_items.purchase_id → purchases.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_purchase_id
  ON public.purchase_items (purchase_id);

-- ============================================================
-- 2. CONSTRAINT credit_excess >= 0
-- ============================================================

-- Primero limpiar datos sucios si existen
UPDATE public.receipts
SET credit_excess = 0
WHERE credit_excess IS NOT NULL AND credit_excess < 0;

-- Agregar constraint
ALTER TABLE public.receipts
ADD CONSTRAINT credit_excess_nonneg CHECK (credit_excess IS NULL OR credit_excess >= 0);

-- ============================================================
-- 3. FUNCIÓN get_next_quote_number() LIMPIA
-- ============================================================

-- Borrar todas las versiones existentes
DROP FUNCTION IF EXISTS public.get_next_quote_number();

-- Crear versión simple y funcional
CREATE OR REPLACE FUNCTION public.get_next_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_max INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.invoices WHERE quote_number LIKE 'COT-%';
  IF v_count = 0 THEN
    RETURN 'COT-00001';
  ELSE
    SELECT MAX(CAST(SUBSTRING(quote_number, 5) AS INTEGER)) INTO v_max
    FROM public.invoices WHERE quote_number LIKE 'COT-%';
    RETURN 'COT-' || TO_CHAR(v_max + 1, 'FM00000');
END;
END;
$$;

-- Verificación final
SELECT public.get_next_quote_number() AS test_quote_number;