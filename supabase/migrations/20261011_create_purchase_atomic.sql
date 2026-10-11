-- ============================================================================
-- Compras atómicas (auditoría 11/10/2026): create_purchase_atomic.
--
-- ORIGEN DEL DEFECTO
--   services/purchases.ts (createPurchase) hacía 3 pasos por separado desde el
--   navegador:
--     1) INSERT en purchases
--     2) INSERT en purchase_items
--     3) add_inventory_stock por cada ítem (una RPC por ítem)
--   Añadía "rollbacks" manuales (DELETE si el paso siguiente fallaba), pero un
--   rollback manual NO protege contra la interrupción del cliente: si se corta
--   internet entre el paso 1 y el 2, el navegador nunca llega a ejecutar el
--   DELETE y queda una compra fantasma SIN sus items. Lo mismo aplica al stock:
--   la compra queda registrada pero el inventario nunca se enteró.
--
-- LA SOLUCIÓN
--   Mover los 3 pasos a UNA sola función en la base de datos. Una función
--   plpgsql se ejecuta como una sola transacción: si algo falla (o se corta la
--   conexión), Postgres revierte TODO automáticamente. O se guarda completo o
--   no se guarda nada. Es el mismo patrón ya usado por
--   apply_invoice_payment_atomic (20260908/20260910).
--
--   Se reutiliza public.add_inventory_stock (PERFORM) en vez de duplicar su
--   lógica: así el costo promedio ponderado y pending_return siguen con una
--   única fuente de verdad.
--
--   El número de compra se calcula DENTRO de la función bajo una advisory lock
--   transaccional, de modo que dos compras simultáneas no pueden recibir el
--   mismo número (antes el cálculo se hacía en el navegador y podía duplicar).
--
--   SECURITY DEFINER + validación de rol: el navegador ya no necesita permiso
--   de INSERT directo sobre purchases/purchase_items/inventory para comprar.
--   Esto además deja el terreno listo para cerrar las políticas RLS abiertas
--   (USING (true)) de products/purchases/purchase_items sin romper el módulo.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_prefix TEXT DEFAULT 'COM-',
  p_supplier_name TEXT DEFAULT NULL,
  p_purchase_date DATE DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_itbis NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_impuesto_recogida NUMERIC DEFAULT 36,
  p_cargo_administracion NUMERIC DEFAULT 200,
  p_total NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'Efectivo',
  p_bank_account_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  OUT p_purchase_id UUID,
  OUT p_purchase_number TEXT
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_num_part BIGINT;
  v_next BIGINT;
  v_item_count INTEGER;
  v_user_id UUID;
BEGIN
  -- 1) Autorización: mismo criterio que el resto de RPCs de negocio.
  IF public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- 2) Validación de entrada.
  IF p_purchase_date IS NULL THEN
    RAISE EXCEPTION 'Fecha de compra requerida';
  END IF;
  IF p_total IS NULL OR p_total < 0 OR p_total > 1000000 THEN
    RAISE EXCEPTION 'Total fuera de rango';
  END IF;

  v_item_count := COALESCE(jsonb_array_length(p_items), 0);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'La compra necesita al menos un producto';
  END IF;

  -- 3) Número consecutivo, serializado entre compras simultáneas.
  PERFORM pg_advisory_xact_lock(hashtext('purchase_number:' || COALESCE(p_prefix, 'COM-')));

  -- Se toma el MÁXIMO valor numérico del sufijo (no el orden alfabético, que
  -- se rompería con números de más de 6 dígitos).
  SELECT COALESCE(MAX(
    CASE WHEN purchase_number ~ ('^' || COALESCE(p_prefix, 'COM-') || '[0-9]+$')
         THEN substring(purchase_number from '([0-9]+)$')::BIGINT
    END
  ), 0)
  INTO v_num_part
  FROM public.purchases;

  v_next := COALESCE(v_num_part, 0) + 1;
  -- lpad rellena a 6, pero TAMBIÉN trunca si el número ya es más largo: se
  -- usa solo cuando hace falta rellenar (igual que padStart en el cliente).
  IF length(v_next::TEXT) < 6 THEN
    p_purchase_number := COALESCE(p_prefix, 'COM-') || lpad(v_next::TEXT, 6, '0');
  ELSE
    p_purchase_number := COALESCE(p_prefix, 'COM-') || v_next::TEXT;
  END IF;

  v_user_id := auth.uid();

  -- 4) Cabecera de la compra.
  INSERT INTO public.purchases (
    purchase_number,
    supplier_name,
    purchase_date,
    subtotal,
    itbis,
    discount_amount,
    impuesto_recogida,
    cargo_administracion,
    total,
    notes,
    payment_method,
    bank_account_id,
    status,
    created_by
  ) VALUES (
    p_purchase_number,
    p_supplier_name,
    p_purchase_date,
    COALESCE(p_subtotal, 0),
    COALESCE(p_itbis, 0),
    COALESCE(p_discount_amount, 0),
    COALESCE(p_impuesto_recogida, 0),
    COALESCE(p_cargo_administracion, 0),
    COALESCE(p_total, 0),
    p_notes,
    COALESCE(p_payment_method, 'Efectivo'),
    p_bank_account_id,
    'COMPLETED',
    v_user_id
  )
  RETURNING id INTO p_purchase_id;

  -- 5) Ítems de la compra (mismas columnas que buildPurchaseItems en el cliente).
  INSERT INTO public.purchase_items (
    purchase_id,
    product_id,
    quantity,
    unit_cost,
    line_total,
    line_itbis,
    itbis
  )
  SELECT
    p_purchase_id,
    item.product_id,
    item.quantity,
    item.unit_cost,
    item.line_total,
    COALESCE(item.line_itbis, 0),
    COALESCE(item.itbis, true)
  FROM jsonb_to_recordset(p_items) AS item(
    product_id UUID,
    quantity NUMERIC,
    unit_cost NUMERIC,
    line_total NUMERIC,
    line_itbis NUMERIC,
    itbis BOOLEAN
  );

  -- 6) Inventario: misma lógica que add_inventory_stock (costo promedio
  --    ponderado sobre stock neto). Al ser parte de ESTA transacción, si algo
  --    falla aquí tampoco se guarda la compra.
  PERFORM public.add_inventory_stock(
    item.product_id,
    item.quantity,
    item.unit_cost,
    item.line_total,
    'PURCHASE',
    'purchase',
    p_purchase_id
  )
  FROM jsonb_to_recordset(p_items) AS item(
    product_id UUID,
    quantity NUMERIC,
    unit_cost NUMERIC,
    line_total NUMERIC,
    line_itbis NUMERIC,
    itbis BOOLEAN
  );
END;
$function$;

-- Postgres concede EXECUTE a PUBLIC en toda función nueva: se revoca antes de
-- conceder solo a los roles previstos.
REVOKE ALL ON FUNCTION public.create_purchase_atomic(TEXT, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_atomic(TEXT, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(TEXT, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) TO authenticated;

COMMIT;
