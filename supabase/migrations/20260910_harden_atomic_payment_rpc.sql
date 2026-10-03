-- ============================================================================
-- H1 (auditoría 10/10/2026): Endurecimiento de apply_invoice_payment_atomic.
--
-- ORIGEN DEL DEFECTO
--   La migración 20260908_atomic_payment_excess.sql creó el RPC sin:
--     a) Validación de entrada. p_amount no se acota. El excedente devuelto es
--        GREATEST(p_amount - p_balance_before, 0): con p_amount arbitrariamente
--        grande el servicio escribe credit_excess enorme en el recibo y el
--        trigger fn_sync_receipt_credit lo convierte en un credit_balance a
--        favor del cliente. Es un vector de crédito prefabricado desde el
--        navegador (createReceipt envía el monto sin cota superior).
--        Las funciones hermanas (use_credit_balance, add_inventory_stock) sí
--        acotaban p_amount <= 1000000: esta quedó fuera del patrón.
--     b) REVOKE EXECUTE FROM public/anon. En Postgres toda función creada sin
--        REVOKE mantiene EXECUTE para PUBLIC, incluido el rol `anon`.
--        El GRANT a `authenticated` de la migración anterior era inocuo.
--     c) Comprobación de rol. Es SECURITY INVOKER (correcto: RLI limita el
--        alcance), pero se documenta explícitamente y se mantiene una guarda
--        coherente con el resto de RPCs de la base.
--     d) Ausencia de SATISFY del tipo OUT en la firma GRANT (el GRANT original
--        usaba (UUID, NUMERIC) en vez del tipo `record` real).
--
-- La lógica financiera NO se modifica: mismo tope, mismo piso, mismos estados
-- y misma fórmula de excedente que la versión del 08/09/2026.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_invoice_payment_atomic(
  p_invoice_id UUID,
  p_amount NUMERIC,
  OUT p_balance_before NUMERIC,
  OUT p_credit_excess NUMERIC
)
RETURNS record
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- 1) Autorización: mismo criterio que las demás RPCs de negocio.
  IF public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- 2) Validación de entrada (paridad con use_credit_balance / inventory RPCs).
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Factura requerida';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Monto inválido: debe ser distinto de cero';
  END IF;
  -- El servicio usa este RPC tanto para aplicar como para revertir pagos, por
  -- lo que se admiten importes negativos; el rango acota ambos sentidos.
  IF p_amount > 1000000 OR p_amount < -1000000 THEN
    RAISE EXCEPTION 'Monto fuera de rango: |monto| debe ser <= 1000000';
  END IF;

  -- 3) Bloquea la fila de la factura: los pagos concurrentes se serializan aquí.
  --    FOR UPDATE garantiza que p_balance_before sea el saldo pendiente REAL previo.
  SELECT total, amount_paid
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  p_balance_before := COALESCE(v_invoice.total, 0) - COALESCE(v_invoice.amount_paid, 0);

  v_new_paid := GREATEST(COALESCE(v_invoice.amount_paid, 0) + COALESCE(p_amount, 0), 0);
  v_new_paid := LEAST(v_new_paid, v_invoice.total);
  v_new_balance := v_invoice.total - v_new_paid;

  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    balance_due = GREATEST(v_new_balance, 0),
    status = CASE
      WHEN v_new_balance <= 0 THEN 'PAID'
      WHEN v_new_paid > 0 THEN 'PARTIAL'
      ELSE 'PENDING'
    END
  WHERE id = p_invoice_id;

  -- 4) Excedente por sobrepago = monto - saldo pendiente previo (atómico).
  p_credit_excess := LEAST(
    GREATEST(COALESCE(p_amount, 0) - p_balance_before, 0),
    1000000
  );
END;
$function$;

-- Postgregres concede EXECUTE a PUBLIC en toda función nueva: se revoca
-- explícitamente antes de conceder solo a los roles previstos.
REVOKE ALL ON FUNCTION public.apply_invoice_payment_atomic(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_invoice_payment_atomic(UUID, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_invoice_payment_atomic(UUID, NUMERIC) TO authenticated;

COMMIT;