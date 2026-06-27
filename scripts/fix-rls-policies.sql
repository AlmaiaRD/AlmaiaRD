-- ============================================================
-- CORRECCIÓN DE POLÍTICAS RLS
-- Reemplaza FOR ALL por políticas explícitas
-- ============================================================

-- Clientes
DROP POLICY IF EXISTS "Users can read all clients" ON clients;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (auth.role() = 'authenticated');

-- Productos
DROP POLICY IF EXISTS "Users can read all products" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Inventario
DROP POLICY IF EXISTS "authenticated_access" ON inventory;
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Facturas
DROP POLICY IF EXISTS "authenticated_access" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Recibos
DROP POLICY IF EXISTS "authenticated_access" ON receipts;
DROP POLICY IF EXISTS "receipts_select" ON receipts;
DROP POLICY IF EXISTS "receipts_insert" ON receipts;
DROP POLICY IF EXISTS "receipts_update" ON receipts;
CREATE POLICY "receipts_select" ON receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "receipts_insert" ON receipts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "receipts_update" ON receipts FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
