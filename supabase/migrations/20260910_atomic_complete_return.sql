-- ============================================================================
-- H1 (auditoría 02/10/2026): completar una devolución deja estados
-- financieros INCONSISTENTES e IRRECUPERABLES.
--
-- BUG ORIGINAL (`src/services/returns.ts` → `completeReturn`)
--
--   La función hacía, en este orden, desde el NAVEGADOR y con llamadas
--   Supabase independientes (ninguna transaccional):
--
--     1. UPDATE returns SET status='COMPLETED'          <- se confirma
--     2. UPDATE invoices  (balance_due, pv_total, status)
--     3. INSERT receipts  (crédito por excedente)       <- puede fallar
--     4. add_inventory_stock() en un bucle, una llamada por renglón
--                                                     <- puede fallar a medias
--
--   Si fallaba el paso 2, 3 o 4, la excepción se propagaba con el estado
--   YA en 'COMPLETED'. El reintento del usuario quedaba bloqueado por la
--   guarda idempotente de la línea 94:
--
--       if (current?.status === "COMPLETED") return current;
--
--   Resultado: devolución marcada como COMPLETADA, pero con el inventario
--   sin reponer y/o el balance de la factura sin reducir, de forma
--   PERMANENTE. Además el paso 4 era un bucle: un fallo en el renglón 3
--   de 5 dejaba los renglones 1-2 ya repuestos y los 4-5 sin reponer.
--
-- CORRECCIÓN
--
--   Se traslada la operación completa a una única función SQL, que se
--   ejecuta dentro de UNA transacción: si cualquier paso falla, TODOS se
--   revierten y `status` permanece intacto, de modo que el reintento es
--   seguro. Se conservan íntegramente las fórmulas financieras del
--   del cliente original (ver "PARIDAD" abajo) para no alterar la contabilidad.
--
-- PARIDAD DE FÓRMULAS (idénticas a las del código anterior)
--
--   returnAmount = SUM(return_items.line_total)
--   returnPv     = SUM(invoice_items.pv * return_items.quantity)
--   balance_due  = GREATEST(0, balance_due - returnAmount)
--   pv_total     = GREATEST(0, pv_total    - returnPv)
--   status       = 'PAID' si balance_due <= 0, si no 'PARTIAL'
--   exceso       = returnAmount - balance_due  (sólo si returnAmount > balance_due)
--   inventario   = add_inventory_stock(..., p_unit_cost = invoice_items.unit_cost)
--                  expandiendo bundle_items cuando el producto es un bundle
--
-- IDEMPOTENCIA
--
--   `SELECT ... FOR UPDATE` bloquea la fila de la devolución. Si el estado
--   ya es 'COMPLETED' se devuelve tal cual (igual que antes), pero ahora sin
--   haber aplicado ningún efecto parcial, porque la transacción entera se
--   revierte ante cualquier error.
--
-- ROLLBACK
--
--   Todo el cambio está contenido en esta migración: basta con eliminarla y
--   revertir a `completeReturn` en el cliente. No altera ninguna fórmula.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_return_atomic(p_return_id UUID)
RETURNS public.returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ret        public.returns;
  v_inv        RECORD;
  v_return_amount NUMERIC := 0;
  v_return_pv     NUMERIC := 0;
  v_new_balance   NUMERIC := 0;
  v_new_pv        NUMERIC := 0;
  v_excess        NUMERIC := 0;
  v_receipt_number TEXT;
  v_user_id     UUID;
  v_item        RECORD;
  v_unit_cost   NUMERIC := 0;
  v_qty         NUMERIC := 0;
  v_comp        RECORD;
  v_is_bundle   BOOLEAN := FALSE;
  v_total       NUMERIC := 0;
BEGIN
  ---------------------------------------------------------------------------
  -- Autorización: replica las políticas RLS de la tabla `returns`
  -- (returns_update: get_user_role() IN ('admin','seller')).
  --
  -- La comprobación de NULL es OBLIGATORIA, no decorativa: `get_user_role()`
  -- es `SELECT role FROM users WHERE id = auth.uid()` y devuelve NULL si no hay
  -- fila para ese usuario o si la llamada es anónima. Como
  -- `NULL NOT IN (...)` evalúa a NULL (no a FALSE) y en PL/pgSQL el `IF` sólo
  -- se ejecuta con TRUE, escribir sólo `NOT IN` concedería la autorización sin
  -- comprobarla. Es el mismo defecto que se corrigió en
  -- 20260910_fix_inventory_rpc_auth_bypass.sql.
  ---------------------------------------------------------------------------
  IF public.get_user_role() IS NULL
     OR public.get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'No autorizado para completar devoluciones';
  END IF;

  IF p_return_id IS NULL THEN
    RAISE EXCEPTION 'ID de devolución requerido';
  END IF;

  ---------------------------------------------------------------------------
  -- Bloqueo de la fila + guarda idempotente.
  ---------------------------------------------------------------------------
  SELECT * INTO v_ret
  FROM public.returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada: %', p_return_id;
  END IF;

  IF v_ret.status = 'COMPLETED' THEN
    RETURN v_ret;
  END IF;

  IF v_ret.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'No se puede completar una devolución cancelada';
  END IF;

  ---------------------------------------------------------------------------
  -- Agregados de la devolución.
  ---------------------------------------------------------------------------
  SELECT COALESCE(SUM(line_total), 0)
    INTO v_return_amount
  FROM public.return_items
  WHERE return_id = p_return_id;

  SELECT COALESCE(SUM(COALESCE(ii.pv, 0) * ri.quantity), 0)
    INTO v_return_pv
  FROM public.return_items ri
  LEFT JOIN public.invoice_items ii
    ON ii.invoice_id = v_ret.invoice_id
   AND ii.product_id = ri.product_id
  WHERE ri.return_id = p_return_id;

  ---------------------------------------------------------------------------
  -- Validación de las líneas contra la FACTURA (no contra el cliente).
  --
  -- `return_items` no tiene RLS de escritura restrictiva suficiente para esto y
  -- el cliente es escribible, así que esta función no puede confiar en lo que
  -- le mandan. Se rechaza la devolución si:
  --
  --   a) alguna línea devuelve un producto que no está en la factura;
  --   b) la cantidad supera lo facturado (restando lo ya devuelto en
  --      devoluciones COMPLETADAS de esa misma factura);
  --   c) el precio unitario no coincide con el facturado.
  --
  -- (c) importa porque el importe de la devolución sale de `return_items` y
  -- se resta de `invoices.balance_due`: un precio inflado reduce el saldo de
  -- una factura que quizá esté ya cobrada y genera crédito espurio por el
  -- excedente (paso 2). Es el mismo modo de fallo que la migración
  -- 20260910_fix_receipt_credit_excess_fallback.sql.
  ---------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.return_items ri
    LEFT JOIN public.invoice_items ii
      ON ii.invoice_id = v_ret.invoice_id
     AND ii.product_id = ri.product_id
    WHERE ri.return_id = p_return_id
      AND (
            ii.id IS NULL
         OR ri.quantity <= 0
         OR ri.quantity > COALESCE(
              ii.quantity
              - COALESCE((
                  SELECT SUM(ri2.quantity)
                  FROM public.return_items ri2
                  JOIN public.returns r2 ON r2.id = ri2.return_id
                  WHERE r2.invoice_id = v_ret.invoice_id
                    AND r2.status = 'COMPLETED'
                    AND r2.id <> p_return_id
                    AND ri2.product_id = ri.product_id
                ), 0), 0)
         OR ROUND(ri.unit_price, 2) <> ROUND(ii.unit_price, 2)
      )
  ) THEN
    RAISE EXCEPTION
      'La devolución no coincide con la factura: producto no facturado, cantidad '
      'mayor a lo facturado, o precio distinto al facturado';
  END IF;

  ---------------------------------------------------------------------------
  -- PASO 1: reversión financiera en la factura.
  ---------------------------------------------------------------------------
  SELECT balance_due, pv_total
    INTO v_inv
  FROM public.invoices
  WHERE id = v_ret.invoice_id
  FOR UPDATE;

  IF FOUND THEN
    v_new_balance := GREATEST(0, COALESCE(v_inv.balance_due, 0) - v_return_amount);
    v_new_pv      := GREATEST(0, COALESCE(v_inv.pv_total, 0) - v_return_pv);

    IF v_return_amount > COALESCE(v_inv.balance_due, 0) THEN
      v_excess := v_return_amount - COALESCE(v_inv.balance_due, 0);
    END IF;

    UPDATE public.invoices
       SET balance_due = v_new_balance,
           pv_total    = v_new_pv,
           status      = CASE WHEN v_new_balance <= 0 THEN 'PAID' ELSE 'PARTIAL' END,
           updated_at  = NOW()
     WHERE id = v_ret.invoice_id;
  END IF;

  ---------------------------------------------------------------------------
  -- PASO 2: crédito por excedente (recibo tipo CREDIT).
  --
  -- `credit_excess` se envía EXPLÍCITAMENTE (nunca NULL) porque el trigger
  -- `fn_sync_receipt_credit` toma ese valor como señal de autoridad: desde la
  -- migración 20260910_fix_receipt_credit_excess_fallback.sql un NULL ya no
  -- dispara el fallback que fabricaba crédito espurio.
  ---------------------------------------------------------------------------
  IF v_excess > 0 THEN
    v_receipt_number := public.fn_generate_receipt_number();

    SELECT auth.uid() INTO v_user_id;

    INSERT INTO public.receipts (
      client_id, invoice_id, payment_method, amount, amount_in_words,
      concept, receipt_number, created_by, credit_excess
    )
    VALUES (
      v_ret.client_id,
      v_ret.invoice_id,
      'CREDIT',
      v_excess,
      v_excess::TEXT,
      'Crédito por devolución excedente #' || LEFT(p_return_id::TEXT, 8),
      v_receipt_number,
      v_user_id,
      v_excess
    );
  END IF;

  ---------------------------------------------------------------------------
  -- PASO 3: reposición de inventario, con expansión de bundles.
  ---------------------------------------------------------------------------
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.return_items
    WHERE return_id = p_return_id
  LOOP
    IF v_item.product_id IS NULL THEN
      CONTINUE;
    END IF;

    v_qty := COALESCE(v_item.quantity, 0);
    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- ¿El producto devuelto es un bundle? Si lo es, se repone cada
    -- componente por separado (misma regla que el código anterior, que
    -- usaba `getBundleComponentMap`).
    v_is_bundle := EXISTS (
      SELECT 1 FROM public.bundle_items WHERE bundle_id = v_item.product_id
    );

    IF v_is_bundle THEN
      FOR v_comp IN
        SELECT bi.product_id,
               bi.quantity,
               -- El costo de reposición NO puede salir de `invoice_items`:
               -- la factura guarda el BUNDLE como una sola línea, así que no
               -- existe línea para el componente y el COALESCE devolvía 0.
               -- Con 0, `add_inventory_stock` promedia el costo del
               -- inventario hacia cero y destruye la valoración. Es el mismo
               -- defecto corregido en `applyInvoiceInventory`; aquí se usa
               -- `inventory.average_cost`, que es lo que ya usa
               -- `restore_inventory_stock` en la devolución.
               COALESCE((
                 SELECT ii.unit_cost
                 FROM public.invoice_items ii
                 WHERE ii.invoice_id = v_ret.invoice_id
                   AND ii.product_id = bi.product_id
               ), (
                 SELECT inv.average_cost
                 FROM public.inventory inv
                 WHERE inv.product_id = bi.product_id
               ), 0) AS unit_cost
        FROM public.bundle_items bi
        WHERE bi.bundle_id = v_item.product_id
      LOOP
        v_unit_cost := COALESCE(v_comp.unit_cost, 0);
        PERFORM public.add_inventory_stock(
          v_comp.product_id,
          v_qty * COALESCE(v_comp.quantity, 1),
          v_unit_cost,
          v_unit_cost * v_qty * COALESCE(v_comp.quantity, 1),
          'RETURN',
          'return',
          p_return_id
        );
      END LOOP;
    ELSE
      SELECT COALESCE(ii.unit_cost, 0)
        INTO v_unit_cost
      FROM public.invoice_items ii
      WHERE ii.invoice_id = v_ret.invoice_id
        AND ii.product_id = v_item.product_id
      LIMIT 1;

      v_unit_cost := COALESCE(v_unit_cost, 0);

      PERFORM public.add_inventory_stock(
        v_item.product_id,
        v_qty,
        v_unit_cost,
        v_unit_cost * v_qty,
        'RETURN',
        'return',
        p_return_id
      );
    END IF;
  END LOOP;

  ---------------------------------------------------------------------------
  -- PASO 4: marcar como completada. Al ser la ÚLTIMA sentencia de la
  -- transacción, si algo falló antes nunca se alcanzó este punto y la
  -- devolución sigue en su estado anterior → el usuario puede reintentar.
  ---------------------------------------------------------------------------
  UPDATE public.returns
     SET status = 'COMPLETED',
         updated_at = NOW()
   WHERE id = p_return_id
  RETURNING * INTO v_ret;

  RETURN v_ret;
END;
$function$;

-- Permisos: por defecto `PUBLIC` tiene EXECUTE sobre las funciones nuevas.
-- Se revoca explícitamente y se concede sólo a usuarios autenticados.
REVOKE ALL ON FUNCTION public.complete_return_atomic(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_return_atomic(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_return_atomic(UUID) TO authenticated;

COMMENT ON FUNCTION public.complete_return_atomic(UUID) IS
  'Completa una devolución (reversión en factura + crédito excedente + reposición de inventario) de forma atómica e idempotente. Autorizado para admin/seller.';
