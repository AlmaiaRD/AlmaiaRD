-- =============================================
-- MIGRACIÓN: Tope de pago + crédito automático en adjust_invoice_payment
-- Fecha: 2026-08-10
--
-- PROBLEMA: El RPC sumaba amount_paid sin tope. Si un recibo excedía el total
-- de la factura, amount_paid quedaba mayor que total y el excedente se perdía
-- (caso real FAC-000004: RD$50 sobrepagados).
--
-- SOLUCIÓN: Si el nuevo amount_paid excede el total, se topa en total y se
-- marca la factura como PAID. Si queda por debajo de cero (reversión de un
-- recibo mayor al pagado), se topa en cero.
--
-- IMPORTANTE: esta función NO crea créditos por el excedente. La creación y
-- reversión del crédito por sobrepago es responsabilidad EXCLUSIVA del trigger
-- trg_sync_receipt_credit sobre receipts (ver 20260811_financial_security_fixes).
-- Hacerlo aquí y en el trigger generaba DOBLE crédito por sobrepago.
--
-- NOTA: Esta migración NO toca el trigger de precios (trg_calculate_prices).
-- =============================================

CREATE OR REPLACE FUNCTION adjust_invoice_payment(p_invoice_id UUID, p_diff NUMERIC)
RETURNS void AS $$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT total, amount_paid INTO v_invoice
  FROM invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_paid := GREATEST(COALESCE(v_invoice.amount_paid, 0) + COALESCE(p_diff, 0), 0);
  v_new_paid := LEAST(v_new_paid, v_invoice.total);
  v_new_balance := v_invoice.total - v_new_paid;

  UPDATE invoices SET
    amount_paid = v_new_paid,
    balance_due = GREATEST(v_new_balance, 0),
    status = CASE
      WHEN v_new_balance <= 0 THEN 'PAID'
      WHEN v_new_paid > 0 THEN 'PARTIAL'
      ELSE 'PENDING'
    END
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;
