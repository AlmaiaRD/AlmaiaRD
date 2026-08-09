-- ============================================================
-- FIX AUDITORÍA: registrar inventory_movements desde las RPCs
-- y helper fn_public_functions para check-functions.mjs
-- ============================================================

-- 1) Helper de diagnóstico: lista funciones reales del schema public.
--    Evita los falsos negativos de invocar funciones sin argumentos.
CREATE OR REPLACE FUNCTION fn_public_functions()
RETURNS TABLE(fn_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.proname::TEXT AS fn_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  GROUP BY p.proname
  ORDER BY p.proname;
$$;

-- 2) add_inventory_stock: ahora también registra inventory_movements.
--    Parámetros opcionales de contexto (tipo, referencia) con valores por defecto
--    para no romper las llamadas existentes de la app.
CREATE OR REPLACE FUNCTION add_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_line_total NUMERIC,
  p_movement_type TEXT DEFAULT 'PURCHASE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    
    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = CASE WHEN v_existing.stock > 0 
        THEN ROUND(((v_existing.average_cost * v_existing.stock) + (p_quantity * p_unit_cost)) / (v_existing.stock + p_quantity), 2)
        ELSE p_unit_cost END,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + p_line_total,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, average_cost, inventory_value)
    VALUES (p_product_id, p_quantity, 0, p_unit_cost, p_line_total);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql;

-- 3) subtract_inventory_stock: registra movimiento SALE/ADJUSTMENT.
CREATE OR REPLACE FUNCTION subtract_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'SALE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  SELECT stock, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_new_stock := GREATEST(0, v_existing.stock - p_quantity);
    v_shortfall := p_quantity - (v_existing.stock - v_new_stock);
    
    UPDATE inventory SET
      stock = v_new_stock,
      pending_return = COALESCE(v_existing.pending_return, 0) + v_shortfall,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, inventory_value, minimum_stock)
    VALUES (p_product_id, 0, p_quantity, 0, 3);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql;

-- 4) restore_inventory_stock: registra movimiento CANCELLATION/RETURN.
CREATE OR REPLACE FUNCTION restore_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'CANCELLATION',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    
    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, minimum_stock, inventory_value)
    VALUES (p_product_id, p_quantity, 0, 3, 0);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql;
