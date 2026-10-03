-- ============================================================================
-- C3 (auditoría 02/10/2026): EVASIÓN DE AUTORIZACIÓN en las RPCs de inventario.
--
-- BUG
--
--   Las tres funciones de stock comprobaban el rol así:
--
--       IF get_user_role() NOT IN ('admin','seller') THEN
--         RAISE EXCEPTION 'No autorizado para gestionar inventario';
--       END IF;
--
--   y `get_user_role()` está definida como:
--
--       SELECT role FROM public.users WHERE id = auth.uid();
--
--   Esa consulta devuelve NULL cuando no existe fila para `auth.uid()`, y
--   devuelve NULL siempre que `auth.uid()` es NULL (llamadas anónimas).
--
--   En SQL, `NULL NOT IN ('admin','seller')` no es FALSE: es NULL. Y en
--   PL/pgSQL el bloque `IF` sólo se ejecuta cuando la condición es TRUE. Por
--   tanto, con rol NULL la comprobación se SALTA por completo y la
--   autorización se concede sola.
--
-- AGRAVANTE
--
--   Las tres funciones sólo tienen `GRANT EXECUTE ... TO authenticated`, pero
--   PostgreScript concede EXECUTE al rol PUBLIC por defecto al crear una
--   función, y aquí nunca se hizo `REVOKE ... FROM PUBLIC`. El rol `anon` --
--   cuya clave es pública, porque es la variable NEXT_PUBLIC_SUPABASE_ANON_KEY
--   que viaja dentro del bundle del navegador -- hereda ese permiso.
--
--   La evasión era por tanto alcanzable SIN AUTENTICARSE: cualquiera con la
--   clave anónima podía invocar por POST /rest/v1/rpc/add_inventory_stock y
--   modificar el stock, el costo promedio y el valor del inventario de
--   cualquier producto.
--
-- CORRECCIÓN (dos capas)
--
--   1) La condición pasa a ser NULL-safe:
--      `get_user_role() IS NULL OR get_user_role() NOT IN (...)`.
--      Se mantiene el mismo criterio de rol y el mismo mensaje de error, así
--      que ningún usuario legítimo cambia de comportamiento.
--
--   2) `REVOKE ALL ... FROM PUBLIC` y `FROM anon`, dejando únicamente
--      `authenticated`. Esto es lo que realmente cierra el hueco; el punto 1
--      es la defensa en profundidad.
--
-- COMPROBACIÓN DE ALCANCE
--
--   Sólo `NOT IN` es peligroso con la lógica de tres valores: `IN (...)` y
--   `= ANY(ARRAY[...])` evalúan a NULL cuando el rol es NULL, y tanto las
--   políticas RLS como los `IF` niegan en ese caso. En este repositorio hay
--   198 usos de `get_user_role() IN (...)` y 86 de `= ANY(ARRAY[...])`, todos
--   ya correctos. Las 3 ocurrencias de `NOT IN` eran exactamente estas.
--
-- PARIDAD
--
--   El resto del cuerpo de las tres funciones (stock neto, `pending_return`,
--   costo promedio ponderado, `inventory_value` y los INSERT en
--   `inventory_movements`) se reproduce SIN cambios. Este archivo se generó
--   sustituyendo únicamente la línea de la condición de rol sobre
--   `20260908_inventory_rpc_role_fix.sql`, por lo que el diff es de una
--   línea por función más los permisos.
--
-- ROLLBACK
--
--   Eliminar esta migración. No altera ninguna fórmula de inventario.
-- ============================================================================

-- ============================================================================
-- R1 (auditoría 08/09/2026): Control de rol en RPCs de inventario.
-- add/subtract/restore_inventory_stock son SECURITY DEFINER y estaban
-- GRANTed a 'authenticated' SIN validar el rol interno: cualquier usuario
-- autenticado podía manipular stock. Se restringe a admin/seller.
-- La lógica financiera/contable de las funciones se mantiene intacta.
-- ============================================================================

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
  -- NULL-safe: con rol NULL (sin fila en `users`, o llamada anon) `NOT IN`
  -- devuelve NULL y el `IF` NO se ejecutaba, con lo que la autorizacion se
  -- concedia sola. Ver cabecera de esta migracion.
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('admin','seller') THEN
    RAISE EXCEPTION 'No autorizado para gestionar inventario';
  END IF;

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
  -- NULL-safe: con rol NULL (sin fila en `users`, o llamada anon) `NOT IN`
  -- devuelve NULL y el `IF` NO se ejecutaba, con lo que la autorizacion se
  -- concedia sola. Ver cabecera de esta migracion.
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('admin','seller') THEN
    RAISE EXCEPTION 'No autorizado para gestionar inventario';
  END IF;

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
  -- NULL-safe: con rol NULL (sin fila en `users`, o llamada anon) `NOT IN`
  -- devuelve NULL y el `IF` NO se ejecutaba, con lo que la autorizacion se
  -- concedia sola. Ver cabecera de esta migracion.
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('admin','seller') THEN
    RAISE EXCEPTION 'No autorizado para gestionar inventario';
  END IF;

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

-- ---------------------------------------------------------------------------
-- PERMISOS
--
-- PostgreScript concede EXECUTE sobre una funcion nueva al rol PUBLIC. Como
-- `anon` es miembro de PUBLIC, los GRANT `a authenticated` que arrastra el
-- cuerpo de arriba NO bastaban: hay que revocar explicitamente a PUBLIC y anon.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;
