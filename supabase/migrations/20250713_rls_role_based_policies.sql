-- =============================================
-- MIGRACIÓN: RLS Policies basadas en roles
-- Crea función helper y políticas por rol
-- =============================================

-- 1. Función helper para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 2. Eliminar políticas existentes para re-crearlas

-- users
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- clients
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;

-- products
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

-- inventory
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;

-- inventory_movements
DROP POLICY IF EXISTS "inventory_movements_select" ON inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_insert" ON inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_delete" ON inventory_movements;

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;

-- receipts
DROP POLICY IF EXISTS "receipts_select" ON receipts;
DROP POLICY IF EXISTS "receipts_insert" ON receipts;
DROP POLICY IF EXISTS "receipts_update" ON receipts;

-- credit_balances
DROP POLICY IF EXISTS "credit_balances_select" ON credit_balances;
DROP POLICY IF EXISTS "credit_balances_insert" ON credit_balances;
DROP POLICY IF EXISTS "credit_balances_update" ON credit_balances;

-- followups
DROP POLICY IF EXISTS "authenticated_access" ON followups;

-- expenses
DROP POLICY IF EXISTS "authenticated_access" ON expenses;

-- bonuses
DROP POLICY IF EXISTS "authenticated_access" ON bonuses;

-- bank_accounts
DROP POLICY IF EXISTS "authenticated_access" ON bank_accounts;

-- settings
DROP POLICY IF EXISTS "authenticated_access" ON settings;

-- suppliers
DROP POLICY IF EXISTS "authenticated_access" ON suppliers;

-- purchases
DROP POLICY IF EXISTS "authenticated_access" ON purchases;

-- purchase_items
DROP POLICY IF EXISTS "authenticated_access" ON purchase_items;

-- communications
DROP POLICY IF EXISTS "authenticated_access" ON communications;

-- audit_logs
DROP POLICY IF EXISTS "authenticated_access" ON audit_logs;

-- whatsapp_configs
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_configs" ON whatsapp_configs;

-- whatsapp_logs
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_logs" ON whatsapp_logs;

-- 3. Crear políticas por rol

-- Niveles de acceso:
--   admin  = CRUD completo en todas las tablas
--   seller = CRUD en datos operativos (clientes, facturas, recibos, comunicaciones)
--            solo LECTURA en datos financieros (inventario, costos, settings, bancos, whatsapp)
--   assistant = solo LECTURA en datos operativos
--               solo LECTURA en datos financieros

-- ===== users =====
-- Cada usuario solo ve su propio registro
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- ===== clients =====
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== categories, subbrands =====
DROP POLICY IF EXISTS "authenticated_access" ON categories;
DROP POLICY IF EXISTS "authenticated_access" ON subbrands;
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "categories_insert" ON categories
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "subbrands_select" ON subbrands
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "subbrands_insert" ON subbrands
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "subbrands_update" ON subbrands
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "subbrands_delete" ON subbrands
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== client_tags, client_tag_relations =====
DROP POLICY IF EXISTS "authenticated_access" ON client_tags;
DROP POLICY IF EXISTS "authenticated_access" ON client_tag_relations;
CREATE POLICY "client_tags_select" ON client_tags
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "client_tags_insert" ON client_tags
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "client_tags_update" ON client_tags
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "client_tags_delete" ON client_tags
  FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "client_tag_relations_select" ON client_tag_relations
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "client_tag_relations_insert" ON client_tag_relations
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "client_tag_relations_delete" ON client_tag_relations
  FOR DELETE USING (get_user_role() IN ('admin', 'seller'));

-- ===== products =====
CREATE POLICY "products_select" ON products
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "products_update" ON products
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "products_delete" ON products
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== inventory (contiene costos) =====
CREATE POLICY "inventory_select" ON inventory
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "inventory_insert" ON inventory
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));

-- ===== inventory_movements =====
CREATE POLICY "inventory_movements_select" ON inventory_movements
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "inventory_movements_insert" ON inventory_movements
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "inventory_movements_delete" ON inventory_movements
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== invoices =====
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));

-- ===== invoice_items =====
CREATE POLICY "invoice_items_select" ON invoice_items
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "invoice_items_insert" ON invoice_items
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "invoice_items_delete" ON invoice_items
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== receipts =====
CREATE POLICY "receipts_select" ON receipts
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "receipts_insert" ON receipts
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "receipts_update" ON receipts
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));

-- ===== credit_balances =====
CREATE POLICY "credit_balances_select" ON credit_balances
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "credit_balances_insert" ON credit_balances
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "credit_balances_update" ON credit_balances
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));

-- ===== followups =====
CREATE POLICY "followups_select" ON followups
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "followups_insert" ON followups
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "followups_update" ON followups
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller', 'assistant'))
  WITH CHECK (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "followups_delete" ON followups
  FOR DELETE USING (get_user_role() IN ('admin', 'seller'));

-- ===== expenses =====
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== bonuses =====
CREATE POLICY "bonuses_select" ON bonuses
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "bonuses_insert" ON bonuses
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "bonuses_update" ON bonuses
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "bonuses_delete" ON bonuses
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== bank_accounts =====
CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "bank_accounts_delete" ON bank_accounts
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== settings (contiene SMTP passwords) =====
CREATE POLICY "settings_select" ON settings
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "settings_insert" ON settings
  FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_update" ON settings
  FOR UPDATE USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_delete" ON settings
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== suppliers =====
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== purchases =====
CREATE POLICY "purchases_select" ON purchases
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "purchases_insert" ON purchases
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "purchases_delete" ON purchases
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== purchase_items =====
CREATE POLICY "purchase_items_select" ON purchase_items
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "purchase_items_insert" ON purchase_items
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "purchase_items_delete" ON purchase_items
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== communications =====
CREATE POLICY "communications_select" ON communications
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "communications_insert" ON communications
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "communications_update" ON communications
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller', 'assistant'))
  WITH CHECK (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "communications_delete" ON communications
  FOR DELETE USING (get_user_role() IN ('admin', 'seller'));

-- ===== audit_logs =====
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));

-- ===== whatsapp_configs (contiene access tokens) =====
CREATE POLICY "whatsapp_configs_select" ON whatsapp_configs
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "whatsapp_configs_insert" ON whatsapp_configs
  FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "whatsapp_configs_update" ON whatsapp_configs
  FOR UPDATE USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "whatsapp_configs_delete" ON whatsapp_configs
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== whatsapp_logs =====
CREATE POLICY "whatsapp_logs_select" ON whatsapp_logs
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "whatsapp_logs_insert" ON whatsapp_logs
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller', 'assistant'));

-- ===== returns =====
CREATE POLICY "returns_select" ON returns
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "returns_insert" ON returns
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "returns_update" ON returns
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "returns_delete" ON returns
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== return_items =====
CREATE POLICY "return_items_select" ON return_items
  FOR SELECT USING (get_user_role() IN ('admin', 'seller', 'assistant'));
CREATE POLICY "return_items_insert" ON return_items
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "return_items_update" ON return_items
  FOR UPDATE USING (get_user_role() IN ('admin', 'seller'))
  WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "return_items_delete" ON return_items
  FOR DELETE USING (get_user_role() = 'admin');
