-- ============================================================================
-- B1: Fix crédito por sobrepago - calcular excedente contra saldo pendiente
-- previo (balance_due antes del pago), no contra total de factura.
-- Agrega columna credit_excess a receipts para que el servicio pase el
-- excedente calculado explícitamente, y el trigger lo use como fuente de verdad.
-- ============================================================================

-- 1. Agregar columna credit_excess a receipts (opcional, calculada por el servicio)
ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS credit_excess NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.receipts.credit_excess IS 'Excedente por sobrepago calculado en el servicio (monto - saldo_pendiente_previo). El trigger usa este valor como prioridad.';

-- 2. Reemplazar fn_sync_receipt_credit para usar credit_excess
DROP TRIGGER IF EXISTS trg_sync_receipt_credit ON public.receipts;

CREATE OR REPLACE FUNCTION public.fn_sync_receipt_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice_balance NUMERIC;
  v_excess NUMERIC;
BEGIN
  -- 1) Si el UPDATE cambió datos financieros, revertir el crédito anterior
  IF TG_OP = 'UPDATE' AND (
    OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
  ) THEN
    DELETE FROM public.credit_balances
    WHERE receipt_id = OLD.id AND status = 'AVAILABLE';

    UPDATE public.clients c SET credit_balance = COALESCE(
      (SELECT SUM(COALESCE(balance, amount)) FROM public.credit_balances
       WHERE client_id = c.id AND status = 'AVAILABLE'), 0
    ) WHERE c.id = OLD.client_id;
  ELSIF TG_OP = 'UPDATE' THEN
    RETURN NEW; -- sin cambios financieros
  END IF;

  -- 2) Calcular excedente: prioridad a credit_excess (calculado por el servicio),
  --    fallback a amount - balance_due actual de la factura (para inserts directos).
  IF NEW.invoice_id IS NOT NULL AND NEW.amount IS NOT NULL AND NEW.client_id IS NOT NULL THEN
    -- Si el servicio pasó credit_excess, úsalo (cálculo correcto contra saldo previo)
    IF COALESCE(NEW.credit_excess, 0) > 0 THEN
      v_excess := NEW.credit_excess;
    ELSE
      -- Fallback: calcular contra balance_due actual de la factura
      -- Para inserts vía servicio, el pago ya se aplicó ANTES del insert,
      -- entonces balance_due actual = saldo_previo - amount (si amount <= saldo_previo)
      -- o 0 (si amount > saldo_previo). El excedente real = amount - saldo_previo.
      -- Con el orden actual, no podemos reconstruir saldo_previo exactamente
      -- cuando hay tope, por eso credit_excess es la vía correcta.
      -- Para inserts directos sin pago aplicado, balance_due = saldo_previo.
      SELECT balance_due INTO v_invoice_balance
      FROM public.invoices WHERE id = NEW.invoice_id;
      v_excess := GREATEST(NEW.amount - COALESCE(v_invoice_balance, NEW.amount), 0);
    END IF;

    IF v_excess > 0 THEN
      INSERT INTO public.credit_balances (client_id, receipt_id, amount, balance, status)
      VALUES (NEW.client_id, NEW.id, v_excess, v_excess, 'AVAILABLE');
    END IF;

    UPDATE public.clients c SET credit_balance = COALESCE(
      (SELECT SUM(COALESCE(balance, amount)) FROM public.credit_balances
       WHERE client_id = c.id AND status = 'AVAILABLE'), 0
    ) WHERE c.id = NEW.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER trg_sync_receipt_credit
  AFTER INSERT OR UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_receipt_credit();

-- 3. Backfill: credit_excess = 0 para recibos existentes (no se puede recalcular
--    histórico sin balance_due previo, pero el trigger de UPDATE recalculará
--    al modificarse)
UPDATE public.receipts SET credit_excess = 0 WHERE credit_excess IS NULL;

-- 4. Agregar 'CREDIT' al CHECK constraint de payment_method
ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_payment_method_check;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_payment_method_check
  CHECK (payment_method = ANY (ARRAY['CASH', 'TRANSFER', 'CARD', 'CREDIT']));