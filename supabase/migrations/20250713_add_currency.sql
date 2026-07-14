-- Añadir soporte multi-moneda (infraestructura básica)

ALTER TABLE settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'DOP';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT;

-- Actualizar invoices existentes con el valor por defecto
UPDATE invoices SET currency = 'DOP' WHERE currency IS NULL;
