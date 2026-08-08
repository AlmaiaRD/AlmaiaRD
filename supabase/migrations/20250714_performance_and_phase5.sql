-- Performance indexes for FK columns used in JOINs
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_bank_account_id ON invoices (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices (created_by);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items (product_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client_id ON receipts (client_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_bank_account_id ON receipts (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items (product_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients (created_by);
CREATE INDEX IF NOT EXISTS idx_followups_client_id ON followups (client_id);
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON communications (client_id);
CREATE INDEX IF NOT EXISTS idx_credit_balances_client_id ON credit_balances (client_id);

-- Add duracion_dias to products (from phase5)
ALTER TABLE products ADD COLUMN IF NOT EXISTS duracion_dias INTEGER;

-- Add AI prompt columns to settings (from phase5)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ai_client_prompt TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ai_learning_prompt TEXT DEFAULT '';

-- Fix whatsapp_configs DDL typo (PRIMARY -> PRIMARY KEY)
-- Note: This requires dropping and recreating the column if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_configs' AND column_name = 'id'
      AND column_default IS NOT NULL
      AND is_nullable = 'NO'
  ) THEN
    -- Column already has proper constraints
  ELSE
    ALTER TABLE whatsapp_configs ALTER COLUMN id SET NOT NULL;
  END IF;
END $$;
