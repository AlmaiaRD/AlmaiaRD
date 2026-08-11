-- ============================================================
-- ALMAIA RD - Limpieza de hallazgos del dump de esquema
-- 1) Versiones viejas de RPC de inventario (duplicadas)
-- 2) Políticas RLS permisivas 'pol_*' que anulan el modelo de roles
-- ============================================================

-- 1. RPC duplicadas: la app usa las versiones con movement_type/references.
DROP FUNCTION IF EXISTS public.add_inventory_stock(uuid, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.subtract_inventory_stock(uuid, numeric);
DROP FUNCTION IF EXISTS public.restore_inventory_stock(uuid, numeric);

-- 2. Políticas RLS permisivas redundantes (solo requieren estar autenticado).
--    Al eliminarlas, las políticas basadas en get_user_role() (admin/seller/
--    assistant) pasan a ser las únicas que gobiernan el acceso.
DROP POLICY IF EXISTS "pol_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "pol_bonuses" ON public.bonuses;
DROP POLICY IF EXISTS "pol_credit_balances" ON public.credit_balances;
DROP POLICY IF EXISTS "pol_expenses" ON public.expenses;
DROP POLICY IF EXISTS "pol_followups" ON public.followups;
DROP POLICY IF EXISTS "pol_inventory" ON public.inventory;
DROP POLICY IF EXISTS "pol_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "pol_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "pol_products" ON public.products;
DROP POLICY IF EXISTS "pol_purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "pol_purchases" ON public.purchases;
DROP POLICY IF EXISTS "pol_receipts" ON public.receipts;
DROP POLICY IF EXISTS "pol_suppliers" ON public.suppliers;
