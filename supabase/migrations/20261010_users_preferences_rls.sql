-- ============================================================================
-- Preferencias/Favoritos: garantizar la política RLS de UPDATE sobre `users`
-- Fecha: 2026-10-10
--
-- Contexto: la app guarda preferencias por usuario en `users.preferences`
-- (favoritos, metas, listas ocultas). La tabla tenía la política de SELECT
-- ("users_select_own") pero podía faltar la de UPDATE, de modo que los UPDATE
-- hechos desde el cliente eran descartados EN SILENCIO (0 filas afectadas, sin
-- error), por lo que los cambios nunca se guardaban.
--
-- Esta migración es IDEMPOTENTE: puede ejecutarse varias veces sin error.
-- Se recomienda ejecutarla en el SQL Editor de Supabase. No es estrictamente
-- necesaria si las escrituras pasan por /api/preferences (que usa service role),
-- pero deja la base en un estado correcto para escrituras directas.
-- ============================================================================

-- 1) SELECT / INSERT / UPDATE del propio registro
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2) El propio usuario no puede cambiar su `role` (anti escalada de privilegios)
CREATE OR REPLACE FUNCTION public.fn_users_prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'El rol no puede modificarse directamente. Contacta al administrador.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_prevent_role_change ON public.users;
CREATE TRIGGER trg_users_prevent_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_users_prevent_role_change();
