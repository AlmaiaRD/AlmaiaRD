-- ============================================================
-- ALMAIA RD - Regresión detectada al quitar políticas 'pol_*'
-- La tabla receipts no tenía política DELETE (antes la cubría pol_receipts).
-- Se restaura el borrado para los roles que ya pueden crear/editar recibos.
-- ============================================================

CREATE POLICY "receipts_delete" ON public.receipts FOR DELETE TO public
  USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
