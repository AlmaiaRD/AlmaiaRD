-- ============================================================================
-- MIGRACIÓN CONSOLIDADA: Fixes financieros y de seguridad
-- Fecha: 2026-08-11
--
-- 1. vw_profitability: la ganancia ya NO incluye el ITBIS como ingreso
--    (el ITBIS cobrado pertenece al gobierno). Se agregan total_revenue y
--    total_itbis para auditoría.
-- 2. adjust_invoice_payment: tope superior (total) e inferior (0). Ya NO crea
--    créditos: esa responsabilidad queda SOLO en el trigger de recibos, para
--    eliminar el riesgo de doble crédito por sobrepago.
-- 3. Créditos por sobrepago: un solo trigger sobre receipts (INSERT/UPDATE/
--    DELETE) crea, revierte y reconcilia el crédito. clients.credit_balance
--    se recalcula SIEMPRE desde credit_balances (elimina la deriva y la fuga
--    al borrar un recibo).
-- 4. Seguridad: users.role no puede cambiarse vía UPDATE directo (trigger);
--    whatsapp_configs pasa a ser de SOLO admin (antes lo leía seller y
--    assistant, exponiendo el access_token); los datos no secretos se exponen
--    vía RPC get_whatsapp_configs_public.
-- 5. use_credit_balance: versión endurecida que descuenta también
--    clients.credit_balance.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ganancia real: excluir ITBIS del ingreso
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_profitability AS
SELECT
  COALESCE(SUM(i.total), 0) AS total_sales,
  COALESCE(SUM(i.total - COALESCE(i.itbis_total, 0)), 0) AS total_revenue,
  COALESCE(SUM(COALESCE(i.itbis_total, 0)), 0) AS total_itbis,
  COALESCE(SUM(ii.unit_cost * ii.quantity), 0) AS total_costs,
  COALESCE((SELECT SUM(expenses.amount) FROM expenses WHERE expenses.expense_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS total_expenses,
  COALESCE((SELECT SUM(bonuses.amount) FROM bonuses WHERE bonuses.bonus_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS total_bonuses,
  COALESCE(SUM(i.total - COALESCE(i.itbis_total, 0)), 0)
    - COALESCE(SUM(ii.unit_cost * ii.quantity), 0) AS gross_profit,
  COALESCE(SUM(i.total - COALESCE(i.itbis_total, 0)), 0)
    - COALESCE(SUM(ii.unit_cost * ii.quantity), 0)
    - COALESCE((SELECT SUM(expenses.amount) FROM expenses WHERE expenses.expense_date >= DATE_TRUNC('month', CURRENT_DATE)), 0)
    - COALESCE((SELECT SUM(bonuses.amount) FROM bonuses WHERE bonuses.bonus_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS real_profit
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.status <> 'CANCELLED' AND i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE);

-- ---------------------------------------------------------------------------
-- 2. adjust_invoice_payment: tope/piso, sin crédito (el trigger lo maneja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_invoice_payment(p_invoice_id uuid, p_diff numeric)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT total, amount_paid INTO v_invoice
  FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

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
$function$;

-- ---------------------------------------------------------------------------
-- 3. Créditos por sobrepago: triggers de reconciliación
--    - AFTER INSERT/UPDATE: crea el crédito por excedente y revierte el
--      anterior si cambió el monto/factura del recibo.
--    - BEFORE DELETE: revierte el crédito ANTES de borrar el recibo (evita
--      violar la FK credit_balances_receipt_id_fkey).
--    clients.credit_balance se recalcula SIEMPRE desde credit_balances
--    (elimina la deriva y la fuga al borrar un recibo).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_excess_payment ON receipts;
DROP TRIGGER IF EXISTS trg_sync_receipt_credit ON receipts;
DROP TRIGGER IF EXISTS trg_receipt_credit_cleanup ON receipts;

CREATE OR REPLACE FUNCTION public.fn_sync_receipt_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice_total NUMERIC;
  v_excess NUMERIC;
  v_recalc_client UUID;
BEGIN
  -- 1) Si el UPDATE cambió datos financieros, revertir el crédito anterior
  IF TG_OP = 'UPDATE' AND (
    OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
  ) THEN
    DELETE FROM credit_balances
    WHERE receipt_id = OLD.id AND status = 'AVAILABLE';

    UPDATE clients c SET credit_balance = COALESCE(
      (SELECT SUM(COALESCE(balance, amount)) FROM credit_balances
       WHERE client_id = c.id AND status = 'AVAILABLE'), 0
    ) WHERE c.id = OLD.client_id;
  ELSIF TG_OP = 'UPDATE' THEN
    RETURN NEW; -- sin cambios financieros
  END IF;

  -- 2) Crear el crédito por excedente, si aplica
  IF NEW.invoice_id IS NOT NULL AND NEW.amount IS NOT NULL AND NEW.client_id IS NOT NULL THEN
    SELECT total INTO v_invoice_total FROM invoices WHERE id = NEW.invoice_id;
    v_excess := GREATEST(NEW.amount - COALESCE(v_invoice_total, NEW.amount), 0);
    IF v_excess > 0 THEN
      INSERT INTO credit_balances (client_id, receipt_id, amount, balance, status)
      VALUES (NEW.client_id, NEW.id, v_excess, v_excess, 'AVAILABLE');
    END IF;

    UPDATE clients c SET credit_balance = COALESCE(
      (SELECT SUM(COALESCE(balance, amount)) FROM credit_balances
       WHERE client_id = c.id AND status = 'AVAILABLE'), 0
    ) WHERE c.id = NEW.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER trg_sync_receipt_credit
  AFTER INSERT OR UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_receipt_credit();

CREATE OR REPLACE FUNCTION public.fn_receipt_credit_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM credit_balances
  WHERE receipt_id = OLD.id AND status = 'AVAILABLE';

  UPDATE clients c SET credit_balance = COALESCE(
    (SELECT SUM(COALESCE(balance, amount)) FROM credit_balances
     WHERE client_id = c.id AND status = 'AVAILABLE'), 0
  ) WHERE c.id = OLD.client_id;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_receipt_credit_cleanup
  BEFORE DELETE ON receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_receipt_credit_cleanup();

-- Backfill: garantizar balance para créditos históricos
UPDATE credit_balances SET balance = amount WHERE balance IS NULL;

-- ---------------------------------------------------------------------------
-- 4a. Seguridad: impedir que un usuario cambie su propio role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_users_prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'El rol no puede modificarse directamente. Contacta al administrador.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_users_prevent_role_change ON users;
CREATE TRIGGER trg_users_prevent_role_change
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.fn_users_prevent_role_change();

-- ---------------------------------------------------------------------------
-- 4b. Seguridad: whatsapp_configs de SOLO admin + datos públicos sin secretos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_configs_select ON whatsapp_configs;
CREATE POLICY "whatsapp_configs_select" ON whatsapp_configs
  FOR SELECT USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS whatsapp_configs_insert ON whatsapp_configs;
CREATE POLICY "whatsapp_configs_insert" ON whatsapp_configs
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.get_whatsapp_configs_public()
RETURNS TABLE (
  id UUID, label TEXT, phone_number_id TEXT, business_account_id TEXT,
  is_active BOOLEAN, created_at TIMESTAMPTZ, has_token BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT w.id, w.label, w.phone_number_id, w.business_account_id, w.is_active,
         w.created_at,
         (w.access_token IS NOT NULL AND w.access_token <> '')
  FROM public.whatsapp_configs w
  WHERE get_user_role() IN ('admin','seller','assistant')
  ORDER BY w.created_at DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_configs_public() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. use_credit_balance endurecido (descuenta clients.credit_balance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_credit_balance(p_credit_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id UUID;
  v_new_balance NUMERIC;
BEGIN
  IF p_credit_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
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
GRANT EXECUTE ON FUNCTION public.use_credit_balance(UUID, NUMERIC) TO authenticated;
