-- Fix: agregar política DELETE para invoices (faltaba; el RLS bloqueaba borrados en silencio)
-- Solo admin puede eliminar facturas, consistente con invoice_items_delete.

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (get_user_role() = 'admin');
