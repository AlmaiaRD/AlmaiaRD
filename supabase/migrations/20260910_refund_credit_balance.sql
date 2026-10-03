-- ============================================================================
-- H2 (auditoría 02/10/2026): `applyCreditToInvoice` puede CONSUMIR un crédito
-- y no dejarlo nunca aplicado.
--
-- BUG ORIGINAL (`src/services/credits.ts`)
--
--   El orden de operaciones era:
--
--     1. use_credit_balance(p_amount)          <- consume el crédito
--     2. SELECT credit_balances ...            <- puede fallar
--     3. calcular nº de recibo                 <- podía producir "REC-000NaN"
--     4. SELECT invoices ...                   <- puede fallar
--     5. adjust_invoice_payment(+amount)
--     6. INSERT receipts
--
--   Los pasos 2-4 throws sin NINGÚN reintento ni compensación: el crédito ya
--   había quedado consumido en el paso 1. Resultado, dinero perdido:
--   `credit_balances.balance` y `clients.credit_balance` reducidos, sin pago
--   aplicado a la factura y sin recibo que lo justifique.
--
--   Además, ni siquiera el fallo del paso 6 (que sí intentaba revertir el paso
--   5) devolvía el crédito del paso 1.
--
-- CORRECCIÓN
--
--   1. Se añade esta función de compensación atómica. Antes no existía forma
--      de "des-usar" un crédito: `use_credit_balance` sólo resta, y el trigger
--      `fn_credit_balances_set_balance` es BEFORE INSERT (no recalcula nada).
--      Un read-modify-write desde el cliente sería susceptible a condición de
--      carrera, de modo que la restauración debe ser atómica y aquí dentro.
--
--   2. `applyCreditToInvoice` se reestructura en `src/services/credits.ts`
--      para compensar CUALQUIER fallo posterior al consumo.
--
-- NOTA SOBRE `status`
--
--   `use_credit_balance` (20260811) NO cambia `credit_balances.status`; sólo
--   descuenta `balance`. Por simetría, `refund_credit_balance` tampoco lo
--   cambia: devolver el dinero es exactamente la inversa aritmética.
--
-- SEGURIDAD
--
--   Mismo control de rol que `use_credit_balance` más la validación de monto.
--   REVOKE a PUBLIC/anon: por defecto las funciones nuevas son ejecutables
--   por cualquiera.
--
-- ROLLBACK
--
--   Eliminar esta migración y la llamada a `refund_credit_balance` en
--   `src/services/credits.ts`. No altera ninguna fórmula de negocio.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refund_credit_balance(p_credit_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id UUID;
  v_current   NUMERIC;
BEGIN
  IF p_credit_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT client_id, COALESCE(balance, amount)
    INTO v_client_id, v_current
  FROM public.credit_balances
  WHERE id = p_credit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado';
  END IF;

  UPDATE public.credit_balances
     SET balance = COALESCE(v_current, 0) + p_amount,
         updated_at = NOW()
   WHERE id = p_credit_id;

  UPDATE public.clients
     SET credit_balance = COALESCE(credit_balance, 0) + p_amount
   WHERE id = v_client_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_credit_balance(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credit_balance(UUID, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_credit_balance(UUID, NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.refund_credit_balance(UUID, NUMERIC) IS
  'Devuelve un monto a un credit_balance (compensación de use_credit_balance). Usado para deshacer una aplicación de crédito que falló a mitad.';
