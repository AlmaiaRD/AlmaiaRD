-- ============================================================================
-- Activación de audit_logs (auditoría 11/10/2026).
--
-- HALLAZGO
--   La tabla public.audit_logs existía y el servicio dashboard.ts la LEÍA
--   (getRecentActivity), pero NADIE escribía en ella: quedaba siempre vacía.
--
-- SOLUCIÓN
--   1) Un trigger por tabla que registra automáticamente quién hizo qué
--      (INSERT/UPDATE/DELETE) sobre las entidades del negocio. Al estar en la
--      base de datos, captura TODOS los caminos (app, SQL directo, etc.) sin
--      depender del frontend.
--   2) Se endurece el acceso a la tabla:
--        - Se elimina la política permisiva "pol_audit_logs" (cualquier
--          autenticado podía leer/escribir TODOS los logs).
--        - Se revoca el acceso a `anon`.
--      La escritura ahora ocurre SOLO vía trigger (SECURITY DEFINER), y la
--      lectura queda para los roles de negocio vía "audit_logs_select".
--
--   El trigger es de esfuerzo mejorado (best-effort): si el registro de
--   auditoría fallara, NUNCA debe impedir la operación principal del negocio.
-- ============================================================================

BEGIN;

-- 1) Función trigger: inserta en audit_logs de forma genérica y segura.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_entity   TEXT := TG_ARGV[0];
  v_action   TEXT := TG_OP;
  v_json     JSONB;
  v_id       UUID;
  v_label    TEXT;
  v_user     UUID;
BEGIN
  v_json := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- id del registro afectado (se tolera si la columna no es uuid).
  BEGIN
    v_id := (v_json->>'id')::uuid;
  EXCEPTION WHEN others THEN
    v_id := NULL;
  END;

  -- Etiqueta legible: primer campo identificador que exista en la tabla.
  v_label := COALESCE(
    v_json->>'full_name',
    v_json->>'name',
    v_json->>'invoice_number',
    v_json->>'purchase_number',
    v_json->>'receipt_number',
    v_json->>'expense_number',
    v_json->>'return_number',
    v_json->>'code',
    v_json->>'email'
  );

  -- Usuario actual. Se valida contra public.users para no violar la FK
  -- audit_logs.user_id -> users.id.
  v_user := auth.uid();
  IF v_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user) THEN
    v_user := NULL;
  END IF;

  -- Registro best-effort: un fallo aquí no debe romper la operación principal.
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
    VALUES (
      v_user,
      v_action,
      v_entity,
      v_id,
      CASE v_action
        WHEN 'INSERT' THEN 'Creado'
        WHEN 'UPDATE' THEN 'Modificado'
        WHEN 'DELETE' THEN 'Eliminado'
      END || CASE WHEN v_label IS NOT NULL THEN ': ' || v_label ELSE '' END
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) Triggers por tabla (solo sobre las que existen, para tolerar desfases).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','invoices','purchases','products',
    'receipts','expenses','returns','suppliers'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;
         CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log(%L);',
        t, t, t, t, t
      );
    END IF;
  END LOOP;
END $$;

-- 3) Endurecimiento de la política y permisos.
--    La política permisiva permitía a cualquier autenticado leer/escribir todos
--    los logs; se elimina. La lectura queda por audit_logs_select (roles de
--    negocio) y la escritura solo vía trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS "pol_audit_logs" ON public.audit_logs;

--    `anon` no debe tener acceso a la auditoría.
REVOKE ALL ON public.audit_logs FROM anon;

COMMIT;
