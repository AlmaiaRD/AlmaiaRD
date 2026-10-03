-- ============================================================================
-- H4 (auditoría 02/10/2026): las vistas de reporting se leen SIN autenticar y
-- saltándose las RLS de las tablas base.
--
-- BUG
--
--   `0000_init_schema.sql` otorga a `anon` privilegios plenos (SELECT, INSERT,
--   UPDATE, DELETE, ...) sobre las siete vistas `vw_*`. La migración
--   `20260901` revocó INSERT/UPDATE/DELETE, pero dejó SELECT.
--
--   Una vista de PostgreSQL no tiene RLS propias: se ejecuta con los
--   privilegios de su PROPIETARIO y salta por completo las políticas RLS de
--   las tablas que consulta. Las tablas base (`clients`, `invoices`,
--   `invoice_items`, `expenses`, `inventory`, `products`) sí tienen RLS
--   activada, pero eso no protege a quien consulta la vista.
--
--   En concreto, `anon` es un rol sin sesión: `get_user_role()` devuelve NULL
--   y cualquier política `IN ('admin','seller')` le negaría el acceso a las
--   tablas. Al leer las vistas se salta precisamente esa comprobación.
--
--   Datos expuestos sin autenticación, con la clave que viaja en el bundle del
--   navegador (NEXT_PUBLIC_SUPABASE_ANON_KEY):
--
--     vw_accounts_receivable : nombre de cada cliente, total facturado, total
--                              pagado, saldo pendiente y CRÉDITO de cada uno
--     vw_profitability       : ventas, ingresos, ITBIS, costos, utilidad
--     vw_pv_summary          : Punto de Venta agregado
--     vw_inventory_value     : costo promedio y valor del inventario
--     vw_top_clients         : ranking de clientes por facturación
--
-- CORRECCIÓN (en dos partes)
--
--   1. `REVOKE ALL ON ... FROM anon`. Ninguna de estas vistas la consulta
--      código de cliente anónimo: todas las llamadas están en páginas
--      autenticadas del panel (`dashboard`, `pv`, `reports`), que ya usan la
--      sesión de Supabase. Revocar a `anon` no cambia el comportamiento de la
--      aplicación.
--
--   2. `ALTER VIEW ... SET (security_invoker = true)`, disponible en
--      PostgreSQL 15+. Con esto la vista pasa a ejecutarse con los privilegios
--      del USUARIO que consulta, de modo que sí se aplican las políticas RLS
--      de `clients`, `invoices`, etc. Es la defensa en profundidad: aunque en
--      el futuro se otorgara SELECT a `anon`, la vista negaría el acceso a las
--      filas que las políticas base no le permiten.
--
--   La 1 sola ya cierra la exposición actual; la 2 evita que vuelva a abrirse
--   por un GRANT futuro.
--
-- COMPATIBILIDAD
--
--   `security_invoker` exige PostgreSQL >= 15. Supabase lo provee. Aun así, el
--   bloque va envuelto en `DO $$ ... EXCEPTION ... $$` para que, si algún
--   entorno antiguo lo rechazara, la migración no se detenga y al menos se
--   aplicara la revocación (que es la parte que cierra el hallazgo).
--
-- ROLLBACK
--
--   Eliminar esta migración. No altera ninguna fórmula: las vistas siguen
--   definiéndose exactamente igual.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Cerrar el acceso anónimo. Ésta es la corrección que resuelve el hallazgo.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.vw_accounts_receivable FROM anon;
REVOKE ALL ON public.vw_inventory_value     FROM anon;
REVOKE ALL ON public.vw_profitability       FROM anon;
REVOKE ALL ON public.vw_pv_summary          FROM anon;
REVOKE ALL ON public.vw_sales_summary       FROM anon;
REVOKE ALL ON public.vw_top_clients         FROM anon;
REVOKE ALL ON public.vw_top_products        FROM anon;

-- `authenticated` sólo necesita lectura; los privilegios de escritura sobre
-- una vista nunca tienen efecto (las vistas simples no son actualizables).
GRANT SELECT ON public.vw_accounts_receivable TO authenticated;
GRANT SELECT ON public.vw_inventory_value     TO authenticated;
GRANT SELECT ON public.vw_profitability       TO authenticated;
GRANT SELECT ON public.vw_pv_summary          TO authenticated;
GRANT SELECT ON public.vw_sales_summary       TO authenticated;
GRANT SELECT ON public.vw_top_clients         TO authenticated;
GRANT SELECT ON public.vw_top_products        TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Que las vistas respeten las RLS de las tablas base.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_view TEXT;
  v_views TEXT[] := ARRAY[
    'vw_accounts_receivable',
    'vw_inventory_value',
    'vw_profitability',
    'vw_pv_summary',
    'vw_sales_summary',
    'vw_top_clients',
    'vw_top_products'
  ];
BEGIN
  FOREACH v_view IN ARRAY v_views LOOP
    BEGIN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = true)', v_view
      );
      RAISE NOTICE 'security_invoker activado en %', v_view;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING
        'No se pudo activar security_invoker en %: %. La revocación a anon de la '
        'sección 1 sigue vigente.', v_view, SQLERRM;
    END;
  END LOOP;
END;
$$;
