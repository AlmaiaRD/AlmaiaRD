-- ============================================================================
-- 20260901_security_cleanup_and_hardening.sql
-- Limpieza de seguridad post-auditoría:
-- 1. REVOKE GRANT excesivos a `anon` (solo SELECT donde RLS lo permita)
-- 2. DROP políticas `pol_*` redundantes (amplían superficie de ataque)
-- 3. CHECK constraints en RPCs de inventario (validación de entrada)
-- 4. CHECK constraints en RPCs de crédito (validación de entrada)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. REVOKE GRANT excesivos a `anon` - solo SELECT en tablas con RLS habilitado
-- ---------------------------------------------------------------------------
-- Nota: Las políticas RLS ya controlan el acceso real. Los GRANT a `anon`
-- con INSERT/UPDATE/DELETE son innecesarios y riesgosos.
-- Mantenemos solo SELECT donde la tabla tenga RLS y políticas que lo permitan.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.audit_logs FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.bank_accounts FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.bonuses FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.bundle_items FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.categories FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.client_tag_relations FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.client_tags FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.clients FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.communications FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.credit_balances FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.expenses FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.followups FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.inventory FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.inventory_movements FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.invoice_items FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.invoices FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.products FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.purchase_items FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.purchases FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.receipts FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.return_items FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.returns FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.settings FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.subbrands FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.suppliers FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.users FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.whatsapp_configs FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.whatsapp_logs FROM anon;

-- Vistas: solo SELECT para anon (ya es default, pero confirmamos)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_accounts_receivable FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_inventory_value FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_profitability FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_pv_summary FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_sales_summary FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_top_clients FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vw_top_products FROM anon;

-- ---------------------------------------------------------------------------
-- 2. DROP políticas `pol_*` redundantes
-- Estas políticas usan solo `auth.role() = 'authenticated'` sin distinción
-- de roles del sistema (admin/seller/assistant), lo que amplía la superficie
-- de ataque. Las políticas role-based explícitas (get_user_role()) ya cubren
-- los permisos necesarios.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "pol_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "pol_bonuses" ON public.bonuses;
DROP POLICY IF EXISTS "pol_credit_balances" ON public.credit_balances;
DROP POLICY IF EXISTS "pol_expenses" ON public.expenses;
DROP POLICY IF EXISTS "pol_followups" ON public.followups;
DROP POLICY IF EXISTS "pol_inventory" ON public.inventory;
DROP POLICY IF EXISTS "pol_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "pol_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "pol_products" ON public.products;
DROP POLICY IF EXISTS "pol_purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "pol_purchases" ON public.purchases;
DROP POLICY IF EXISTS "pol_receipts" ON public.receipts;
DROP POLICY IF EXISTS "pol_suppliers" ON public.suppliers;

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints en RPCs de inventario - validación de entrada
-- ---------------------------------------------------------------------------

-- add_inventory_stock (versión 1)
CREATE OR REPLACE FUNCTION public.add_inventory_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_line_total numeric
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Costo unitario inválido: debe ser >= 0';
  END IF;
  IF p_line_total IS NULL OR p_line_total < 0 THEN
    RAISE EXCEPTION 'Total de línea inválido: debe ser >= 0';
  END IF;

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
END;
$function$;

-- add_inventory_stock (versión 2 con movement_type)
CREATE OR REPLACE FUNCTION public.add_inventory_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_line_total numeric,
  p_movement_type text DEFAULT 'PURCHASE',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Costo unitario inválido: debe ser >= 0';
  END IF;
  IF p_line_total IS NULL OR p_line_total < 0 THEN
    RAISE EXCEPTION 'Total de línea inválido: debe ser >= 0';
  END IF;

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
$function$;

-- subtract_inventory_stock (versión 1)
CREATE OR REPLACE FUNCTION public.subtract_inventory_stock(
  p_product_id uuid,
  p_quantity numeric
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;

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
END;
$function$;

-- subtract_inventory_stock (versión 2 con movement_type)
CREATE OR REPLACE FUNCTION public.subtract_inventory_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text DEFAULT 'SALE',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;

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
$function$;

-- restore_inventory_stock (versión 1)
CREATE OR REPLACE FUNCTION public.restore_inventory_stock(
  p_product_id uuid,
  p_quantity numeric
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;

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
END;
$function$;

-- restore_inventory_stock (versión 2 con movement_type)
CREATE OR REPLACE FUNCTION public.restore_inventory_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text DEFAULT 'CANCELLATION',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  -- Validación de entrada
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y <= 10000';
  END IF;

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
$function$;

-- ---------------------------------------------------------------------------
-- 4. CHECK constraints en use_credit_balance - validación reforzada
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.use_credit_balance(p_credit_id uuid, p_amount numeric)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
  v_client_id UUID;
  v_new_balance NUMERIC;
  v_role TEXT;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin','seller','assistant') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Validación de entrada
  IF p_credit_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'Monto inválido: debe ser > 0 y <= 1000000';
  END IF;

  SELECT client_id, COALESCE(balance, amount) - p_amount
    INTO v_client_id, v_new_balance
  FROM credit_balances
  WHERE id = p_credit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado';
  END IF;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE credit_balances
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = p_credit_id;

  UPDATE clients
  SET credit_balance = GREATEST(COALESCE(credit_balance, 0) - p_amount, 0)
  WHERE id = v_client_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.use_credit_balance(uuid, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. CHECK constraint en fn_handle_excess_payment - validación de monto
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_handle_excess_payment()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
DECLARE
  invoice_total NUMERIC(12,2);
  excess NUMERIC(12,2);
BEGIN
  SELECT total INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
  IF NEW.amount > invoice_total THEN
    excess := NEW.amount - invoice_total;
    IF excess <= 0 OR excess > 1000000 THEN
      RAISE EXCEPTION 'Exceso de pago inválido';
    END IF;
    INSERT INTO credit_balances (client_id, receipt_id, amount, status)
    VALUES (NEW.client_id, NEW.id, excess, 'AVAILABLE');
    UPDATE clients SET credit_balance = COALESCE(credit_balance, 0) + excess
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Asegurar search_path en get_user_role (ya corregido en 20260813, reafirmar)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$ SELECT role FROM public.users WHERE id = auth.uid(); $function$;

COMMIT;