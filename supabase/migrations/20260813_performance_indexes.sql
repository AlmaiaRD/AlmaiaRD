-- ============================================================================
-- Performance: índices para acelerar búsquedas y filtros críticos
-- ============================================================================

-- Búsqueda de clientes por nombre/teléfono/email
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients USING btree (full_name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm ON public.clients USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON public.clients USING gin (email gin_trgm_ops);

-- Búsqueda de productos por nombre/código
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products USING btree (name);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products USING btree (code);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_code_trgm ON public.products USING gin (code gin_trgm_ops);

-- Filtrado de facturas por fecha
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices USING btree (status);

-- Filtrado de recibos por fecha
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON public.receipts USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_client_invoice ON public.receipts USING btree (client_id, invoice_id);

-- Filtrado de movimientos de inventario
CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type ON public.inventory_movements USING btree (movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON public.inventory_movements USING btree (reference_type, reference_id);

-- Filtrado de créditos
CREATE INDEX IF NOT EXISTS idx_credit_balances_client_status ON public.credit_balances USING btree (client_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_balances_receipt_id ON public.credit_balances USING btree (receipt_id);
CREATE INDEX IF NOT EXISTS idx_credit_balances_status ON public.credit_balances USING btree (status);

-- Filtrado de devoluciones
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns USING btree (created_at);

-- Filtrado de seguimientos
CREATE INDEX IF NOT EXISTS idx_followups_next_followup ON public.followups USING btree (next_followup);
CREATE INDEX IF NOT EXISTS idx_followups_status ON public.followups USING btree (status);

-- Filtrado de configuraciones/settings (usa id como PK, no key)

-- Vista de inventario: índice composite para stock bajo
CREATE INDEX IF NOT EXISTS idx_inventory_stock_min ON public.inventory USING btree (stock, minimum_stock);

-- Habilitar pg_trgm para índices trgm (si no está habilitado)
CREATE EXTENSION IF NOT EXISTS pg_trgm;