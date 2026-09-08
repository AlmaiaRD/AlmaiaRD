-- ============================================================================
-- R2 (auditoría 08/09/2026): Aplicar pago de factura y calcular el excedente
-- por sobrepago de forma ATÓMICA.
-- Elimina la race de crédito por sobrepago (M1): el excedente se calcula
-- contra balance_due PREVIO dentro de la misma transacción que aplica el pago,
-- usando SELECT ... FOR UPDATE para serializar pagos concurrentes sobre la
-- factura.
-- El servicio (createReceipt) llama a este RPC y pasa credit_excess al recibo;
-- el trigger fn_sync_receipt_credit lo usa como fuente de verdad.
-- La fórmula de pago replica exactamente adjust_invoice_payment
-- (tope/piso/estados). La lógica financiera se conserva.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_invoice_payment_atomic(
  p_invoice_id UUID,
  p_amount NUMERIC,
  OUT p_balance_before NUMERIC,
  OUT p_credit_excess NUMERIC
)
RETURNS record
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Bloquea la fila de la factura: los pagos concurrentes se serializan aquí.
  -- FOR UPDATE garantiza que p_balance_before sea el saldo pendiente REAL previo.
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

  -- Excedente por sobrepago = monto - saldo pendiente previo (consistente y atómico).
  p_credit_excess := GREATEST(COALESCE(p_amount, 0) - p_balance_before, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_invoice_payment_atomic(UUID, NUMERIC) TO authenticated;