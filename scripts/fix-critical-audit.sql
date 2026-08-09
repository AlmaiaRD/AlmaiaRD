-- ============================================================
-- AUDITORÍA — CORRECCIÓN DE CRÍTICOS
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. DOBLE CONTEO DE PAGOS EN RECIBOS
-- El trigger trg_receipt_invoice actualiza amount_paid al
-- insertar un recibo, PERO la app además llama adjust_invoice_payment
-- → el pago se suma 2 veces. La app ya gestiona los ajustes vía RPC
-- (createReceipt, updateReceiptWithInvoice, deleteReceipt), así que el
-- trigger es redundante y dañino. Se elimina.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_receipt_invoice ON receipts;
DROP FUNCTION IF EXISTS fn_update_invoice_on_receipt();

-- NOTA: trg_excess_payment (créditos por excedente) se MANTIENE,
-- no interfiere con amount_paid.

-- ------------------------------------------------------------
-- 2. TRIGGER DE PRECIOS AUTOMÁTICOS
-- No estaba instalado (los inserts vía API/script dejaban price_30/35=0).
-- Se instala con la FÓRMULA NUEVA: roundToNearest50(cost × itbisMult × markup),
-- consistente con la app. Solo recalcula si el precio NO viene dado
-- (NULL o 0) para no pisar precios manuales/calculados por la app.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_product_prices()
RETURNS TRIGGER AS $$
DECLARE
  v_itbis_mult NUMERIC;
BEGIN
  v_itbis_mult := CASE WHEN NEW.apply_itbis IS NOT FALSE THEN 1.18 ELSE 1 END;
  IF NEW.price_30 IS NULL OR NEW.price_30 = 0 THEN
    NEW.price_30 := CEIL(NEW.cost * v_itbis_mult * 1.30 / 50) * 50;
  END IF;
  IF NEW.price_35 IS NULL OR NEW.price_35 = 0 THEN
    NEW.price_35 := CEIL(NEW.cost * v_itbis_mult * 1.35 / 50) * 50;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_prices ON products;
CREATE TRIGGER trg_calculate_prices
  BEFORE INSERT OR UPDATE OF cost, apply_itbis ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_product_prices();

-- ------------------------------------------------------------
-- 3. VERIFICACIÓN
-- ------------------------------------------------------------
-- Tras ejecutar, correr en el SQL Editor:
--   SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_receipt_invoice','trg_calculate_prices');
-- Debe devolver SOLO trg_calculate_prices.
