-- ============================================================================
-- H6 (auditoría 02/10/2026): RPCs ejecutables por `anon` y por el rol PUBLIC.
--
-- BUG
--
--   En PostgreScript, toda función creada recibe `EXECUTE` para el rol
--   `PUBLIC` por defecto. `PUBLIC` incluye a `anon`, cuya clave es pública
--   (viaja en el bundle del navegador como NEXT_PUBLIC_SUPABASE_ANON_KEY).
--
--   Hay dos patrones distintos en este repositorio y sólo uno está bien:
--
--     Correcto:   REVOKE ... FROM anon, PUBLIC;  GRANT ... TO authenticated;
--     Incorrecto: GRANT ... TO authenticated;    (sin revocar PUBLIC)
--
--   El patrón incorrecto deja la función ejecutable por `anon`. Y cuando la
--   función es SECURITY DEFINER, el Privilegio no es el de `anon` sino el del
--   propietario, con lo que `anon` puede ejecutar lógica que las políticas RLS
--   de las tablas base tendrían negada.
--
--   El caso más grave de esta auditoría fue exactamente este patrón en las
--   RPCs de inventario (ver 20260910_fix_inventory_rpc_auth_bypass.sql):
--   `GRANT ... TO authenticated` sin `REVOKE FROM PUBLIC`, combinado con un
--   chequeo de rol que no era NULL-safe.
--
--   Auditoría de las RPCs de negocio que seguían con este defecto:
--
--     adjust_invoice_payment  (SECURITY INVOKER)  usada por receipts/credits
--                                               para mover amount_paid
--     use_credit_balance     (SECURITY DEFINER)  descuenta créditos y saldo
--     get_settings_public    (SECURITY DEFINER)  expone datos de negocio
--     get_whatsapp_configs_public, get_telegram_configs_public
--     get_next_quote_number, fn_generate_*
--
--   `use_credit_balance` sí tenía `REVOKE ... FROM anon, PUBLIC` (20260813),
--   pero ese REVOKE es anterior a la redefinición de la función en 20260901.
--   El `CREATE OR REPLACE` conserva los privilegios existentes, así que el
--   revoke sigue siendo válido: no es un fallo. Se incluye igualmente en el
--   revoke idempotente de abajo para que el estado final no dependa del
--   orden en que se aplicaron las migraciones.
--
-- CORRECCIÓN
--
--   Revocar `EXECUTE` a `PUBLIC` y a `anon` en todas las RPCs de negocio, y
--   concederlo sólo a `authenticated`. Es idempotente y no altera ninguna
--   fórmula: sólo cambia QUIÉN puede invocar la función.
--
--   Se excluyen deliberadamente:
--
--     * Los triggers (`fn_handle_excess_payment`, `fn_sync_receipt_credit`,
--       `fn_users_prevent_role_change`, `fn_credit_balances_set_balance`,
--       `touch_updated_at`, `fn_receipt_credit_cleanup`): no son invocables
--       por RPC; sólo se disparan desde la tabla que los asocia.
--     * `get_user_role()`: es la función de la que dependen TODAS las
--       políticas RLS del proyecto. Revocar su ejecución provocaría errores
--       en cada `SELECT`. Es inocua por construcción: sólo devuelve el rol
--       del propio `auth.uid()` a quien pregunta.
--
--   Las funciones `fn_generate_*` / `get_next_quote_number` se mantienen
--   accesibles para `authenticated` porque el cliente las usa para sugerir
--   el siguiente correlativo; ninguna escribe datos.
--
-- ROLLBACK
--
--   Eliminar esta migración. No altera datos ni fórmulas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ajustes de pago: mueven `invoices.amount_paid` / `balance_due`.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.adjust_invoice_payment(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_invoice_payment(UUID, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_invoice_payment(UUID, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- Créditos: SECURITY DEFINER, descuenta `credit_balances` y `clients`.
-- El revoke de 20260813 antecede a la redefinición de 20260901; se reafirma.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.use_credit_balance(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.use_credit_balance(UUID, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.use_credit_balance(UUID, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- Configuración: SECURITY DEFINER, expone datos de negocio del negocio.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_settings_public() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_settings_public() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_settings_public() TO authenticated;

REVOKE ALL ON FUNCTION public.get_whatsapp_configs_public() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_whatsapp_configs_public() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_configs_public() TO authenticated;

REVOKE ALL ON FUNCTION public.get_telegram_configs_public() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_telegram_configs_public() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_telegram_configs_public() TO authenticated;

-- ---------------------------------------------------------------------------
-- Correlativos: sólo lectura, sin efectos secundarios.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_next_quote_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_quote_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_quote_number() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_generate_invoice_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_generate_invoice_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_invoice_number() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_generate_purchase_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_generate_purchase_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_purchase_number() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_generate_receipt_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_generate_receipt_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_receipt_number() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_generate_quote_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_generate_quote_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_quote_number() TO authenticated;
