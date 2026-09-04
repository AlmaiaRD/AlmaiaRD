-- ============================================================================
-- 20260903_security_rls_post_audit.sql
-- Re-auditoría septiembre 2026 - Corrección de hallazgo de seguridad
--
-- HALLAZGO: 6 tablas tenían políticas RLS definidas (admin/seller/assistant
-- vía get_user_role()) pero RLS a nivel de tabla estaba DESHABILITADO
-- (relrowsecurity = false). Como anon conservaba GRANT SELECT, cualquier
-- persona sin login podía leer esas tablas directamente vía PostgREST.
--
-- CORRECCIÓN:
-- 1. Habilitar ROW LEVEL SECURITY en las 6 tablas afectadas para que las
--    políticas existentes tengan efecto real.
-- 2. REVOKE SELECT a `anon` en tablas con datos sensibles (devoluciones y
--    tags de clientes) - innecesario para acceso autenticado.
--
-- NOTA: No se cambiaron las definiciones de las políticas; solo se activó
-- el RLS. `categories` y `subbrands` conservan GRANT SELECT a anon (datos de
-- catálogo de solo lectura), pero con RLS habilitado y sin política para
-- anon, el acceso queda bloqueado igualmente vía API REST.
-- ============================================================================

BEGIN;

-- 1. Habilitar Row Level Security en las tablas que tenían políticas
--    definidas pero RLS desactivado
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subbrands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- 2. Revocar acceso SELECT público en tablas con datos sensibles
REVOKE SELECT ON public.returns FROM anon;
REVOKE SELECT ON public.return_items FROM anon;
REVOKE SELECT ON public.client_tags FROM anon;
REVOKE SELECT ON public.client_tag_relations FROM anon;

COMMIT;
