-- ============================================================
-- ALMAIA RD - Endurecimiento de validaciones críticas (req 153)
-- Aplicable sobre la BD viva: data verificada previamente.
-- ============================================================

-- 1. Toda factura debe tener cliente (no permitir facturas sin cliente)
ALTER TABLE public.invoices ALTER COLUMN client_id SET NOT NULL;

-- 2. Un pago mayor a cero siempre requiere factura asociada.
--    La restricción se expresa como CHECK para permitir recibos de monto 0
--    o créditos/notas sin factura, pero jamás pagos reales sin factura.
ALTER TABLE public.receipts ADD CONSTRAINT receipts_positive_payment_requires_invoice
  CHECK (amount <= 0 OR invoice_id IS NOT NULL);
