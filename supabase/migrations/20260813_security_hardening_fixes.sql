-- ============================================================================
-- 20260813_security_hardening_fixes.sql
-- Auditoría 2026-08-13 — Correcciones de seguridad críticas/altas
-- ----------------------------------------------------------------------------
-- C2: users.role DEFAULT 'admin' + INSERT débil -> default 'assistant' +
--     trigger BEFORE INSERT que fuerza 'assistant' salvo service_role.
-- C3: settings.smtp_pass legible por anon/authenticated -> REVOKE.
-- C4: use_credit_balance SECURITY DEFINER sin autorización -> validar rol.
-- C7: bundle_items con RLS solo authenticated -> restringir por get_user_role().
-- C10: get_user_role SECURITY DEFINER sin SET search_path -> fijar path.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- C2. Default de role -> 'assistant' + trigger que impide insertar admin
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'assistant';

CREATE OR REPLACE FUNCTION public.fn_users_secure_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Solo el service_role (scripts/backend) puede crear usuarios con rol admin/seller
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Cualquier insert vía anon/authenticated fuerza el rol 'assistant'
  NEW.role := 'assistant';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_users_secure_insert ON public.users;
CREATE TRIGGER trg_users_secure_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_users_secure_insert();

-- ---------------------------------------------------------------------------
-- C10. get_user_role con search_path fijo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$ SELECT role FROM public.users WHERE id = auth.uid(); $function$;

-- ---------------------------------------------------------------------------
-- C3. smtp_pass no debe leerse por anon/authenticated
-- ---------------------------------------------------------------------------
REVOKE SELECT, INSERT, UPDATE, REFERENCES (smtp_pass) ON public.settings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- C7. bundle_items restringido por rol del sistema (admin gestiona bundles;
--     seller/assistant solo lectura)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bundle_items_select ON public.bundle_items;
CREATE POLICY "bundle_items_select" ON public.bundle_items
  FOR SELECT TO public
  USING (get_user_role() IN ('admin','seller','assistant'));

DROP POLICY IF EXISTS bundle_items_insert ON public.bundle_items;
CREATE POLICY "bundle_items_insert" ON public.bundle_items
  FOR INSERT TO public
  WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS bundle_items_update ON public.bundle_items;
CREATE POLICY "bundle_items_update" ON public.bundle_items
  FOR UPDATE TO public
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS bundle_items_delete ON public.bundle_items;
CREATE POLICY "bundle_items_delete" ON public.bundle_items
  FOR DELETE TO public
  USING (get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- C4. use_credit_balance: solo admin/seller/assistant, nunca anon
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.use_credit_balance(uuid, numeric) FROM anon, PUBLIC;

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

GRANT EXECUTE ON FUNCTION public.use_credit_balance(uuid, numeric) TO authenticated;

COMMIT;
