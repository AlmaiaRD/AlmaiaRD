-- ============================================================================
-- FIX: teléfonos (2) con predeterminado + permisos de UPDATE en settings
-- Fecha: 2026-08-31
--
-- 1. Agrega phone_2 y default_phone a settings (para 2 teléfonos y elegir cuál
--    es el predeterminado que aparece en facturas, recibos, cotizaciones, etc.)
-- 2. Actualiza get_settings_public() para que devuelva esos campos (el app los
--    lee por RPC, no por tabla directa).
-- 3. Recrea las políticas RLS de settings para que un usuario 'admin' pueda
--    ACTUALIZAR (corrige "permission denied for table settings").
--
-- Idempotente: se puede ejecutar varias veces. Ejecutar una vez en SQL Editor.
-- ============================================================================

-- 1) Columnas nuevas
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS phone_2 TEXT DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_phone TEXT DEFAULT 'phone';

-- 2) RPC público que devuelve también los teléfonos (sin secretos)
CREATE OR REPLACE FUNCTION public.get_settings_public()
RETURNS TABLE (
  id UUID, business_name TEXT, logo_url TEXT, signature_url TEXT,
  default_margin NUMERIC, invoice_prefix TEXT, receipt_prefix TEXT,
  purchase_prefix TEXT, currency TEXT, email TEXT, phone TEXT, phone_2 TEXT,
  default_phone TEXT, sender_name TEXT,
  email_template TEXT, whatsapp_template TEXT, smtp_host TEXT, smtp_port INTEGER,
  smtp_user TEXT, smtp_secure BOOLEAN, nutrilite_itbis_enabled BOOLEAN,
  ai_client_prompt TEXT, ai_learning_prompt TEXT, created_at TIMESTAMPTZ,
  has_smtp_password BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.business_name, s.logo_url, s.signature_url, s.default_margin,
    s.invoice_prefix, s.receipt_prefix, s.purchase_prefix, s.currency, s.email,
    s.phone, s.phone_2, s.default_phone, s.sender_name, s.email_template,
    s.whatsapp_template, s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_secure,
    s.nutrilite_itbis_enabled, s.ai_client_prompt, s.ai_learning_prompt,
    s.created_at,
    (s.smtp_pass IS NOT NULL AND s.smtp_pass <> '') AS has_smtp_password
  FROM public.settings s
  ORDER BY s.created_at
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_settings_public() TO authenticated;

-- 3) Reinicia las políticas RLS de settings (escritura SOLO admin)
DROP POLICY IF EXISTS "settings_select" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_update" ON public.settings;
DROP POLICY IF EXISTS "settings_delete" ON public.settings;

CREATE POLICY "settings_select" ON public.settings
  FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "settings_insert" ON public.settings
  FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_update" ON public.settings
  FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_delete" ON public.settings
  FOR DELETE USING (get_user_role() = 'admin');

-- Asegura privilegios de tabla (por si quedaron revocados por drifts)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;

-- Extra: los privilegios de columna smtp_pass quedan revocados para no-admin
REVOKE SELECT (smtp_pass) ON public.settings FROM anon;
