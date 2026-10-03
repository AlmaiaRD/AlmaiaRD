-- ============================================================================
-- H5 (auditoría 02/10/2026): `settings.smtp_pass` sigue siendo legible
-- aunque la aplicación afirma que no lo es.
--
-- BUG
--
--   El servicio de ajustes afirma en un comentario:
--
--     // Sin .select(): tras la migración, smtp_pass no es seleccionable
--     // ni por admin.
--
--   pero eso no es cierto. En PostgreSQL los privilegios a NIVEL DE TABLA y a
--   NIVEL DE COLUMNA son independientes, y el de mayor nivel manda: un
--   `GRANT SELECT ON settings` concede SELECT sobre TODAS las columnas,
--   incluida la secreta, y un `REVOKE SELECT (smtp_pass)` posterior sólo
--   retira el privilegio de columna, sin tocar el de tabla.
--
--   La secuencia de migraciones es exactamente ese patrón:
--
--     0000_init_schema.sql:1151
--       GRANT ... SELECT ... ON public.settings TO authenticated;   <- tabla
--     20250810_hardening_consolidated.sql:242
--       REVOKE SELECT (smtp_pass) ON public.settings FROM ...;       <- columna
--     20260813_security_hardening_fixes.sql:57
--       REVOKE SELECT, INSERT, UPDATE, REFERENCES (smtp_pass) ...; <- columna
--     20260831_settings_phones_and_rls.sql:62
--       GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings
--         TO authenticated;                                       <- TABLA OTRA VEZ
--     20260831_settings_phones_and_rls.sql:65
--       REVOKE SELECT (smtp_pass) ON public.settings FROM anon;     <- sólo anon
--
--   El último `GRANT` a nivel de tabla (línea 62 de 20260831) vuelve a
--   conceder SELECT sobre `smtp_pass` a `authenticated`. El `REVOKE` de
--   columna siguiente sólo cubre a `anon`. Resultado: cualquier usuario
--   autenticado que supere la política RLS (`admin` o `seller`) puede leer la
--   contraseña SMTP en claro con un simple
--   `supabase.from("settings").select("smtp_pass")`.
--
--   La política RLS `settings_select` limita a admin/seller, así que no es
--   lectura anónima; pero un `seller` no debería poder leer un secreto de
--   infraestructura, y la intención declarada en el código dice lo
--   contrario.
--
-- CORRECCIÓN
--
--   La forma correcta de excluir una columna en PostgreSQL es invertir la
--   estrategia: revocar SELECT a nivel de TABLA y concederlo columna por
--   columna. Así no queda ningún privilegio de tabla que arrastre el secreto.
--
--     REVOKE SELECT ON public.settings FROM authenticated, anon;
--     GRANT  SELECT (id, business_name, ...) ON public.settings TO authenticated;
--
--   La lista incluye todas las columnas EXCEPTO `smtp_pass`. Se listan
--   explícitamente porque el conjunto evoluciona: si alguien añade una
--   columna sensible con `ALTER TABLE`, no heredará el privilegio (eso es
--   justo lo que se quiere).
--
-- COMPATIBILIDAD CON EL RESTO DEL CÓDIGO
--
--   Todas las lecturas de la aplicación siguen funcionando:
--
--     * `getSettings()` usa la RPC `get_settings_public()` (o
--       `get_settings_with_secrets()`), que son SECURITY DEFINER y eligen
--       explícitamente qué columnas devuelven. No dependen de los privileges
--       de columna de la tabla.
--     * `src/services/settings.ts:44` tiene un respaldo
--       `.from("settings").select("*")` para cuando la RPC no existe. Con
--       privilegios por columna, PostgREST resuelve el `*` comprobando cada
--       columna: `smtp_pass` simplemente no viene y el resto sí. El tipo
--       `SettingsRow` ya modela `smtp_pass` como opcional y
--       `normalizeSettings()` fuerza `smtp_pass = ""` cuando no se piden
--       secretos, así que el valor ausente es el esperado.
--     * Las lecturas parciales (`receipt_prefix`, `ai_client_prompt`, ...)
--       piden columnas concretas, todas incluidas en la lista de abajo.
--
--   Se mantiene `UPDATE` intacto a propósito: bloquear la escritura
--   introduciría un riesgo de rotura funcional sin beneficio de seguridad,
--   ya que la política RLS `settings_update` ya la restringe a `admin`, y
--   `updateSettings()` escribe con `.update(patch)` sin `.select()` para no
--   devolver la columna.
--
-- ROLLBACK
--
--   Eliminar esta migración. No altera datos ni fórmulas.
-- ============================================================================

-- 1) Retirar el SELECT a nivel de tabla, que es el que arrastra el secreto.
REVOKE SELECT ON public.settings FROM anon;
REVOKE SELECT ON public.settings FROM authenticated;

-- 2) Reponer SELECT columna por columna, excluyendo `smtp_pass`.
--    La lista se deriva de las columnas reales de la tabla más las añadidas
--    en migraciones posteriores (phone_2, default_phone, quote_prefix).
GRANT SELECT (
  id,
  address,
  business_name,
  logo_url,
  signature_url,
  email,
  phone,
  phone_2,
  default_phone,
  sender_name,
  email_template,
  whatsapp_template,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_secure,
  ai_client_prompt,
  ai_learning_prompt,
  default_margin,
  invoice_prefix,
  receipt_prefix,
  purchase_prefix,
  quote_prefix,
  currency,
  nutrilite_itbis_enabled,
  created_at,
  updated_at
) ON public.settings TO authenticated;

-- 3) `anon` se queda sin lectura de la tabla. Ningún camino de la aplicación
--    lee `settings` de forma anónima: los datos públicos de negocio pasan por
--    la RPC `get_settings_public()`, que es SECURITY DEFINER y decide qué
--    columnas expone.
REVOKE ALL ON public.settings FROM anon;
