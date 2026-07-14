-- Soft delete para clients: en lugar de DELETE, se marca deleted_at

ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índice para filtrar rápidamente clientes no eliminados
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients (deleted_at);
