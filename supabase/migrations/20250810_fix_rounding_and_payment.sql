-- =============================================
-- MIGRACIÓN: Correcciones de auditoría financiera (2026-08-10)
-- Fix 2: Trigger de precios sin ITBIS embebido (base = cost × margen exacta)
-- Fix 3: adjust_invoice_payment con tope + crédito automático
--
-- Esquema de precios/facturación:
--   Catálogo: Costo, Costo+ITBIS, Venta 30% c/ITBIS, Venta 35% c/ITBIS
--             (los dos últimos = roundUpTo50(cost × margen × 1.18))
--   Factura:  subtotal + ITBIS exacto (18%) + línea "Redondeo" = total
--             redondeado a múltiplo de 50. El redondeo lo absorbe el margen,
--             nunca el ITBIS.
-- =============================================

-- ─────────────────────────────────────────────
-- Fix 2: Trigger de cálculo de precios
-- ─────────────────────────────────────────────
-- PROBLEMA: La fórmula anterior embebía el ITBIS en el PRECIO BASE
-- (cost * 1.18 * 1.30). La aplicación YA aplica ITBIS al total de la
-- línea (18% exacto en computeInvoiceMath), por lo que los productos
-- generados por el trigger terminaban con DOBLE ITBIS (1.18 × 1.18 ≈ 39%
-- de margen inflado).
--
-- SOLUCIÓN: El precio base se calcula SIN ITBIS y SIN redondear a 50
-- (ROUND(cost × margen, 2)). El redondeo al múltiplo de 50 ocurre SOLO al
-- TOTAL de la factura (roundUpTo50 en computeInvoiceMath), donde la
-- diferencia la absorbe el margen — nunca el ITBIS.
--
-- IMPORTANTE: Solo afecta productos NUEVOS o cuando se cambia cost /
-- apply_itbis. Los precios existentes (cost × 1.30 exacto) ya cumplen este
-- esquema y no requieren normalización.

CREATE OR REPLACE FUNCTION fn_calculate_product_prices()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price_30 IS NULL OR NEW.price_30 = 0 THEN
    NEW.price_30 := ROUND(NEW.cost * 1.30, 2);
  END IF;
  IF NEW.price_35 IS NULL OR NEW.price_35 = 0 THEN
    NEW.price_35 := ROUND(NEW.cost * 1.35, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_prices
  BEFORE INSERT OR UPDATE OF cost, apply_itbis ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_product_prices();

-- ─────────────────────────────────────────────
-- Fix 3: adjust_invoice_payment con tope + crédito
-- ─────────────────────────────────────────────
-- PROBLEMA: El RPC sumaba el pago sin tope; si un recibo excedía el
-- total de la factura, amount_paid quedaba mayor que total y el
-- excedente se perdía (caso real FAC-000004: RD$50 sobrepagados).
--
-- SOLUCIÓN: Si el nuevo amount_paid excede el total, se topa en total,
-- se marca la factura como PAID y el excedente se registra
-- automáticamente como crédito AVAILABLE para el cliente.

CREATE OR REPLACE FUNCTION adjust_invoice_payment(p_invoice_id UUID, p_diff NUMERIC)
RETURNS void AS $$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
  v_excess NUMERIC;
BEGIN
  SELECT total, amount_paid, client_id INTO v_invoice
  FROM invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_paid := COALESCE(v_invoice.amount_paid, 0) + p_diff;
  v_excess := GREATEST(v_new_paid - v_invoice.total, 0);
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

  -- Registrar el excedente como crédito disponible del cliente
  IF v_excess > 0 AND v_invoice.client_id IS NOT NULL THEN
    INSERT INTO credit_balances (client_id, amount, status)
    VALUES (v_invoice.client_id, v_excess, 'AVAILABLE');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- NOTA RLS (hallazgo #7 de la auditoría)
-- ─────────────────────────────────────────────
-- Verificado en BD viva: RLS ya está habilitado con políticas por rol
-- (supabase/migrations/20250713_rls_role_based_policies.sql). El usuario
-- admin (role='admin') tiene acceso completo y lecturas anónimas devuelven
-- 0 filas. NO aplicar scripts/fix-rls-policies.sql (reintroduciría
-- políticas de acceso total para cualquier 'authenticated').
