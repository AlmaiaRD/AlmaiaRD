-- Migración: Revocar los overloads muertos de inventario
-- Fecha: 2026-10-05
-- Riesgo: NULO - No toca datos, no altera ninguna función, solo permisos
--
-- CONTEXTO
-- -------
-- Existen 6 versiones de las funciones de inventario: 3 "largas" (con
-- p_movement_type, p_reference_type, p_reference_id) y 3 "cortas".
-- Las 6 nacieron en 20260908_inventory_rpc_role_fix.sql / 20260910 y las cortas
-- quedaron huerfanas: el codigo de la app nunca las ha llamado (commit d37f94c
-- las usaba; desde entonces todas las llamadas pasan por las largas).
--
-- Las cortas son SECURITY INVOKER y NO tienen guarda de rol. Hoy no son
-- explotables porque `anon` no tiene INSERT/UPDATE sobre inventory ni
-- inventory_movements, asi que la llamada revienta con "permission denied"
-- antes de escribir nada. Pero son una mina enterrada: en cuanto alguien
-- regale permiso de escritura a `anon` por error, se convierten en un
-- agujero invisible.
--
-- Que se hace
-- -----------
-- - Se le quita EXECUTE a PUBLIC y a `anon` en las 3 cortas.
-- - Se le deja EXECUTE a `authenticated`, para que una version antigua
--   desplegada o una pestana vieja del navegador sigan funcionando.
-- - Las 3 largas NO se tocan: son las que usa la app y ya estan cerradas
--   (sin EXECUTE para anon, con guarda NULL-safe).
--
-- Idempotente: se puede ejecutar las veces que haga falta.

BEGIN;

-- ------------------------------------------------------------
-- 1. Quitarle el permiso al visitante anónimo
-- ------------------------------------------------------------
-- Ojo: hay un GRANT explicito para anon en el ACL, asi que no basta con
-- revocar de PUBLIC. Hay que nombrar a los dos.

REVOKE ALL ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC)
  FROM PUBLIC, anon;

-- ------------------------------------------------------------
-- 2. Dejarlo funcionando para quien si tiene cuenta
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.subtract_inventory_stock(UUID, NUMERIC)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.restore_inventory_stock(UUID, NUMERIC)
  TO authenticated;

COMMIT;

-- ============================================================
-- VERIFICACION (deve devolver 0 en las 3 filas)
-- ============================================================
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS firma,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logueado_puede
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('add_inventory_stock','subtract_inventory_stock','restore_inventory_stock')
--    AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%movement_type%'
--  ORDER BY p.proname;