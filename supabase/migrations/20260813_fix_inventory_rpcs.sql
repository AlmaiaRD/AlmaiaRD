-- ============================================================================
-- B2/B3: Fix RPCs de inventario - inventory_value y average_cost correctos
-- Mantiene la firma de 20250810 (movement_type, reference_type, reference_id, log)
-- - subtract_inventory_stock: reduce inventory_value = cantidad * average_cost
-- - add_inventory_stock: average_cost ponderado sobre stock NETO (stock - pending_return)
-- - restore_inventory_stock: actualiza inventory_value y average_cost
-- ============================================================================

-- add_inventory_stock: average_cost ponderado sobre stock NETO (excluye pending_return)
CREATE OR REPLACE FUNCTION public.add_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_line_total NUMERIC,
  p_movement_type TEXT DEFAULT 'PURCHASE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
  v_net_stock NUMERIC;
  v_new_net_stock NUMERIC;
  v_new_avg_cost NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Costo unitario inválido';
  END IF;
  IF p_line_total IS NULL OR p_line_total < 0 THEN
    RAISE EXCEPTION 'Total de línea inválido';
  END IF;

  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM public.inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    -- Stock neto = stock - pending_return (solo stock vendible)
    v_net_stock := GREATEST(0, v_existing.stock - v_pending);
    v_new_net_stock := v_net_stock + (p_quantity - v_fulfill);

    -- Costo promedio ponderado sobre stock NETO
    IF v_net_stock > 0 THEN
      v_new_avg_cost := ROUND(
        ((COALESCE(v_existing.average_cost, 0) * v_net_stock) + ((p_quantity - v_fulfill) * p_unit_cost))
        / v_new_net_stock, 2
      );
    ELSE
      v_new_avg_cost := p_unit_cost;
    END IF;

    UPDATE public.inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = v_new_avg_cost,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + p_line_total,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO public.inventory (product_id, stock, pending_return, average_cost, inventory_value)
    VALUES (p_product_id, p_quantity, 0, p_unit_cost, p_line_total);
  END IF;

  INSERT INTO public.inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

-- subtract_inventory_stock: reduce stock e inventory_value al costo promedio actual
CREATE OR REPLACE FUNCTION public.subtract_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'SALE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
  v_cost_reduction NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM public.inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_new_stock := GREATEST(0, v_existing.stock - p_quantity);
    v_shortfall := p_quantity - (v_existing.stock - v_new_stock);
    -- Reducir inventory_value por lo que sale al costo promedio actual
    v_cost_reduction := LEAST(p_quantity, v_existing.stock) * COALESCE(v_existing.average_cost, 0);

    UPDATE public.inventory SET
      stock = v_new_stock,
      pending_return = COALESCE(v_existing.pending_return, 0) + v_shortfall,
      inventory_value = GREATEST(COALESCE(inventory_value, 0) - v_cost_reduction, 0),
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO public.inventory (product_id, stock, pending_return, inventory_value, minimum_stock)
    VALUES (p_product_id, 0, p_quantity, 0, 3);
  END IF;

  INSERT INTO public.inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

-- restore_inventory_stock: restaura stock y actualiza inventory_value/average_cost
CREATE OR REPLACE FUNCTION public.restore_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'CANCELLATION',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
  v_net_stock NUMERIC;
  v_new_net_stock NUMERIC;
  v_new_avg_cost NUMERIC;
  v_cost_addition NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM public.inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    -- Stock neto actual
    v_net_stock := GREATEST(0, v_existing.stock - v_pending);
    v_new_net_stock := v_net_stock + (p_quantity - v_fulfill);

    -- Costo de lo que se restaura = al costo promedio actual
    v_cost_addition := (p_quantity - v_fulfill) * COALESCE(v_existing.average_cost, 0);

    -- Recalcular average_cost si hay stock neto previo
    IF v_net_stock > 0 THEN
      v_new_avg_cost := ROUND(
        ((COALESCE(v_existing.average_cost, 0) * v_net_stock) + v_cost_addition)
        / v_new_net_stock, 2
      );
    ELSE
      v_new_avg_cost := COALESCE(v_existing.average_cost, 0);
    END IF;

    UPDATE public.inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = v_new_avg_cost,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + v_cost_addition,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO public.inventory (product_id, stock, pending_return, minimum_stock, inventory_value)
    VALUES (p_product_id, p_quantity, 0, 3, 0);
  END IF;

  INSERT INTO public.inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;