-- Agrega la opción "Todas las cuentas" en facturas:
-- si show_all_bank_accounts = true, la factura lista todas las cuentas bancarias
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS show_all_bank_accounts BOOLEAN NOT NULL DEFAULT false;
