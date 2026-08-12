-- ============================================================================
-- FIX: RPCs de settings que faltaron en la BD viva
-- Fecha: 2026-08-11
--
-- Contexto: 20250810_hardening_consolidated.sql se aplicó de forma parcial
-- (políticas, get_user_role e RPCs de inventario sí; estos dos RPCs no).
-- Sin get_settings_public, getSettings() insertaba una fila de settings nueva
-- en cada llamada sin caché -> duplicados en cascada y config "que cambia sola".
--
-- Idempotente: CREATE OR REPLACE + GRANT. Ejecutar una vez en SQL Editor.
-- ============================================================================

-- Settings públicos (sin secretos) + indicador de que hay contraseña guardada.
CREATE OR REPLACE FUNCTION public.get_settings_public()
RETURNS TABLE (
  id UUID, business_name TEXT, logo_url TEXT, signature_url TEXT,
  default_margin NUMERIC, invoice_prefix TEXT, receipt_prefix TEXT,
  purchase_prefix TEXT, currency TEXT, email TEXT, phone TEXT, sender_name TEXT,
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
    s.phone, s.sender_name, s.email_template, s.whatsapp_template, s.smtp_host,
    s.smtp_port, s.smtp_user, s.smtp_secure, s.nutrilite_itbis_enabled,
    s.ai_client_prompt, s.ai_learning_prompt, s.created_at,
    (s.smtp_pass IS NOT NULL AND s.smtp_pass <> '') AS has_smtp_password
  FROM public.settings s
  ORDER BY s.created_at
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_settings_public() TO authenticated;

-- Settings con secretos: SOLO admin (para el envío real de correo).
CREATE OR REPLACE FUNCTION public.get_settings_with_secrets()
RETURNS SETOF public.settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.* FROM public.settings s
  WHERE get_user_role() = 'admin'
  ORDER BY s.created_at
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_settings_with_secrets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_settings_with_secrets() TO authenticated;
