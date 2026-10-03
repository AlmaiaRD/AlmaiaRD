-- ============================================================================
-- C1 (auditoría 10/10/2026): CRÍTICO -Crédito FICTICIO al cliente por pagos
-- parciales mayores al 50 % del saldo pendiente.
--
-- ORIGEN DEL DEFECTO
--   fn_sync_receipt_credit (definida en 20260813_fix_credit_excess.sql) elegía
--   el valor del crédito por sobrepago así:
--
--       IF COALESCE(NEW.credit_excess, 0) > 0 THEN
--         v_excess := NEW.credit_excess;          -- servicio calculó excedente
--       ELSE
--         SELECT balance_due INTO v_invoice_balance FROM invoices WHERE id = NEW.invoice_id;
--         v_excess := GREATEST(NEW.amount - COALESCE(v_invoice_balance, NEW.amount), 0);
--       END IF;
--
--   El problema: el servicio aplica el pago a la factura ANTES de insertar el
--   recibo, por lo que cuando llega al trigger `balance_due` YA está
--   decrementado. Cuando el pago NO genera excedente real el servicio escribe
--   credit_excess = 0, y la condición `COALESCE(...,0) > 0` cae al ELSE, que
--   interpreta el saldo YA pagado como si fuera el saldo previo.
--
--   Reproducción determinista (sin base de datos):
--     factura total = 1000, saldo = 1000
--     recibo amount = 600
--       -> servicio: credit_excess = max(0, 600 - 1000) = 0        (correcto)
--       -> adjust_invoice_payment: balance_due = 1000 - 600 = 400
--       -> trigger ELSE: v_excess = max(0, 600 - 400) = 200         (FICTICIO)
--     Se insertan 200.00 RD$ en credit_balances para un cliente que pagó
--     exactamente lo adeudado.
--
--   En general: cualquier recibo con monto > 50 % del saldo pendiente genera
--   crédito fantasma de (2·monto − saldo). Con pagos parciales habituales esto
--   se dispara de forma masiva.
--
--   Rutas de inserción afectadas (las 3 escriben credit_excess explícitamente):
--     · services/receipts.ts        -> createReceipt
--     · services/credits.ts         -> applyCreditToInvoice  (usar crédito para
--                                       pagar una factura GENERABA crédito nuevo)
--     · services/returns.ts         -> completeReturn
--
-- CORRECCIÓN
--   `credit_excess IS NOT NULL` pasa a ser la señal de autoridad. Un 0 explícito
--   significa "el servicio calculó que no hay excedente" y se respeta. El
--   fallback heurístico queda reservado para el caso genuinamente no informado
--   (NULL), del que solo debe hacer uso una inserción directa.
--
--   NOTA DE COMPATIBILIDAD: las tres rutas de la aplicación envían el valor
--   explícito, por lo que el comportamiento de producción no cambia salvo en el
--   defecto. Se retira el DEFAULT 0 de la columna para que NULL sea alcanzable
--   y el fallback quede reservado a las inserciones directas.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. El valor por defecto 0 impedía distinguir "sin excedente" de "no informado".
--    Se elimina: las 3 rutas de la app ya lo envían siempre.
-- ---------------------------------------------------------------------------
ALTER TABLE public.receipts ALTER COLUMN credit_excess DROP DEFAULT;

COMMENT ON COLUMN public.receipts.credit_excess IS
  'Excedente por sobrepago calculado por el servicio (monto - saldo_pendiente_previo). '
  'NULL = no informado por el servicio (inserción directa): el trigger aplica la '
  'heurística de respaldo. 0 = el servicio calculó que NO hay excedente: el trigger '
  'NO debe crear crédito.';

-- ---------------------------------------------------------------------------
-- 2. Trigger corregido
-- ---------------------------------------------------------------------------
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
  -- 1) Si el UPDATE cambió datos financieros, revertir el crédito anterior.
  IF TG_OP = 'UPDATE' AND (
    OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.credit_excess IS DISTINCT FROM NEW.credit_excess
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

  -- 2) Calcular excedente.
  IF NEW.invoice_id IS NOT NULL AND NEW.amount IS NOT NULL AND NEW.client_id IS NOT NULL THEN
    IF NEW.credit_excess IS NOT NULL THEN
      -- Fuente de verdad: el servicio aplicó el pago de forma atómica
      -- (apply_invoice_payment_atomic) y calculó el excedente contra el saldo
      -- pendiente PREVIO real. Un 0 explícito es una afirmación válida:
      -- "este pago no genera crédito". Nunca se debe reinterpretar.
      v_excess := GREATEST(NEW.credit_excess, 0);
    ELSE
      -- Fallback para INSERCIONES DIRECTAS que no informaron credit_excess.
      -- Solo es correcto si el pago NO fue aplicado previamente a la factura
      -- (en ese caso balance_due sigue siendo el saldo previo). Si el pago ya
      -- se aplicó, este cálculo es incorrecto por diseño y por eso se
      -- desaconseja usar esta vía: se prefiere createReceipt / applyCreditToInvoice.
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

COMMIT;

-- ============================================================================
-- 3. AUDITORÍA DE DATOS (NO destructiva - ejecutar y revisar antes de tocar)
-- ------------------------------------------------------------------------===
-- Los créditos fantasma NO se borran automáticamente: son registros financieros
-- y cada fila requiere confirmación humana. Ejecutar esta consulta para ver el
-- alcance real antes de decidir:
--
--   SELECT r.id            AS receipt_id,
--          r.receipt_number,
--          r.client_id,
--          r.amount,
--          r.credit_excess  AS declared_excess,
--          cb.amount        AS credit_granted,
--          r.created_at
--     FROM public.receipts r
--     JOIN public.credit_balances cb
--       ON cb.receipt_id = r.id AND cb.status = 'AVAILABLE'
--    WHERE COALESCE(r.credit_excess, 0) = 0      -- el servicio dijo "sin excedente"
--      AND r.invoice_id IS NOT NULL
--      AND cb.amount > 0                          -- ...pero se emitió crédito
--    ORDER BY r.created_at DESC;
--
-- Si la consulta devuelve filas, esos créditos fueron emitidos por el bug.
-- Corrección manual por recibo (SOLO tras revisar la lista):
--
--   DELETE FROM public.credit_balances WHERE receipt_id = <id> AND status = 'AVAILABLE';
--   -- luego recalcular el saldo del cliente:
--   UPDATE public.clients c SET credit_balance = COALESCE(
--     (SELECT SUM(COALESCE(balance, amount)) FROM public.credit_balances
--      WHERE client_id = c.id AND status = 'AVAILABLE'), 0)
--   WHERE c.id = <client_id>;