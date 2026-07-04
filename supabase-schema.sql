-- ============================================================
-- ALMAIA RD - Esquema Maestro de Base de Datos
-- PostgreSQL / Supabase
-- Versión 1.0
-- ============================================================

-- 1. CATÁLOGOS BASE
-- ============================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subbrands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. USUARIOS
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'seller', 'assistant')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CLIENTES
-- ============================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  ibo_number TEXT,
  notes TEXT,
  credit_balance NUMERIC(12,2) DEFAULT 0,
  stage TEXT DEFAULT 'lead',
  first_contact_date DATE,
  lead_source TEXT,
  interest TEXT,
  next_followup_date DATE,
  last_contact_date DATE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE client_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE client_tag_relations (
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, tag_id)
);

-- 4. PRODUCTOS
-- ============================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  subcategory TEXT,
  category_id UUID REFERENCES categories(id),
  subbrand_id UUID REFERENCES subbrands(id),
  description TEXT,
  benefits TEXT,
  cost NUMERIC(12,2) DEFAULT 0,
  pv NUMERIC(10,2) DEFAULT 0,
  price_30 NUMERIC(12,2) DEFAULT 0,
  price_35 NUMERIC(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  apply_itbis BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. INVENTARIO
-- ============================================================

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  minimum_stock INTEGER DEFAULT 3,
  average_cost NUMERIC(12,2) DEFAULT 0,
  inventory_value NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'CANCELLATION')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PROVEEDORES
-- ============================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. COMPRAS
-- ============================================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  purchase_date DATE NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  itbis NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  impuesto_recogida NUMERIC(12,2) DEFAULT 36,
  cargo_administracion NUMERIC(12,2) DEFAULT 200,
  total NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  line_itbis NUMERIC(12,2) DEFAULT 0,
  itbis BOOLEAN DEFAULT true
);

-- 8. CUENTAS BANCARIAS
-- ============================================================

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  id_number TEXT DEFAULT '',
  email TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. FACTURAS
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  invoice_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) DEFAULT 0,
  pv_total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  bank_account_id UUID REFERENCES bank_accounts(id),
  margin INTEGER DEFAULT 30,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  pv NUMERIC(10,2) DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL
);

-- 9. RECIBOS
-- ============================================================

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER', 'CARD')),
  amount NUMERIC(12,2) NOT NULL,
  amount_in_words TEXT,
  concept TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. SALDOS A FAVOR
-- ============================================================

CREATE TABLE credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  receipt_id UUID REFERENCES receipts(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. CRM / SEGUIMIENTO
-- ============================================================

CREATE TABLE followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  contact_date DATE NOT NULL,
  next_followup DATE,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'OVERDUE'))
);

-- 12. GASTOS
-- ============================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'Efectivo' NOT NULL,
  beneficiary TEXT,
  receipt_number TEXT,
  subcategory TEXT,
  is_deductible BOOLEAN DEFAULT false,
  branch TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period TEXT,
  comments TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. BONIFICACIONES
-- ============================================================

CREATE TABLE bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_date DATE NOT NULL,
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('BONIFICACIÓN', 'INCENTIVO', 'PREMIO', 'REEMBOLSO')),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. CONFIGURACIÓN
-- ============================================================

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT DEFAULT 'Almaia RD',
  logo_url TEXT,
  signature_url TEXT,
  default_margin NUMERIC DEFAULT 30,
  invoice_prefix TEXT DEFAULT 'FAC-',
  receipt_prefix TEXT DEFAULT 'REC-',
  purchase_prefix TEXT DEFAULT 'COM-',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. AUDITORÍA
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. COMUNICACIONES
-- ============================================================

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'whatsapp')),
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('outgoing', 'incoming')),
  subject TEXT,
  body TEXT,
  document_type TEXT CHECK (document_type IN ('invoice', 'receipt')),
  document_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- ============================================================
-- FUNCIONES DE GENERACIÓN DE NÚMEROS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(invoice_prefix, 'FAC-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(invoice_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM invoices WHERE invoice_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(receipt_prefix, 'REC-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(receipt_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM receipts WHERE receipt_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_generate_purchase_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(purchase_prefix, 'COM-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(purchase_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM purchases WHERE purchase_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS AUTOMÁTICOS
-- ============================================================

-- Trigger: Calcular precios automáticos en productos
CREATE OR REPLACE FUNCTION fn_calculate_product_prices()
RETURNS TRIGGER AS $$
BEGIN
  NEW.price_30 := ROUND(NEW.cost * 1.30, 2);
  NEW.price_35 := ROUND(NEW.cost * 1.35, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_prices
  BEFORE INSERT OR UPDATE OF cost ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_product_prices();

-- Trigger: Actualizar inventario al registrar compra
CREATE OR REPLACE FUNCTION fn_update_inventory_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (product_id, stock, average_cost, inventory_value)
  VALUES (NEW.product_id, NEW.quantity, NEW.unit_cost, NEW.quantity * NEW.unit_cost)
  ON CONFLICT (product_id) DO UPDATE SET
    stock = inventory.stock + NEW.quantity,
    average_cost = (inventory.average_cost * inventory.stock + NEW.quantity * NEW.unit_cost) / (inventory.stock + NEW.quantity),
    inventory_value = (inventory.inventory_value + NEW.line_total),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_inventory
  AFTER INSERT ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_inventory_on_purchase();

-- Trigger: Descontar inventario al crear factura
CREATE OR REPLACE FUNCTION fn_update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory SET
    stock = stock - NEW.quantity,
    inventory_value = inventory_value - (NEW.unit_cost * NEW.quantity),
    updated_at = now()
  WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_inventory
  AFTER INSERT ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_inventory_on_sale();

-- Trigger: Calcular totales de factura y balance
CREATE OR REPLACE FUNCTION fn_calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pv_total := COALESCE(
    (SELECT SUM(ii.pv * ii.quantity) FROM invoice_items ii WHERE ii.invoice_id = NEW.id), 0
  );
  NEW.balance_due := NEW.total - NEW.amount_paid;
  IF NEW.balance_due = 0 AND NEW.amount_paid > 0 THEN
    NEW.status := 'PAID';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'PARTIAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Actualizar factura al recibir pago
CREATE OR REPLACE FUNCTION fn_update_invoice_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices SET
    amount_paid = amount_paid + NEW.amount,
    balance_due = total - (amount_paid + NEW.amount),
    status = CASE
      WHEN total - (amount_paid + NEW.amount) <= 0 THEN 'PAID'
      ELSE 'PARTIAL'
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_invoice
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_invoice_on_receipt();

-- Trigger: Manejo de excedentes (pago > saldo)
CREATE OR REPLACE FUNCTION fn_handle_excess_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total NUMERIC(12,2);
  excess NUMERIC(12,2);
BEGIN
  SELECT total INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
  IF NEW.amount > invoice_total THEN
    excess := NEW.amount - invoice_total;
    INSERT INTO credit_balances (client_id, receipt_id, amount, status)
    VALUES (NEW.client_id, NEW.id, excess, 'AVAILABLE');
    UPDATE clients SET credit_balance = COALESCE(credit_balance, 0) + excess
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_excess_payment
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION fn_handle_excess_payment();

-- Trigger: Reponer inventario al anular factura
CREATE OR REPLACE FUNCTION fn_restore_inventory_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    UPDATE inventory i
    SET stock = i.stock + ii.quantity,
        updated_at = now()
    FROM invoice_items ii
    WHERE ii.invoice_id = NEW.id AND i.product_id = ii.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cancellation_restore
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED')
  EXECUTE FUNCTION fn_restore_inventory_on_cancellation();

-- ============================================================
-- VISTAS SQL ESTRATÉGICAS
-- ============================================================

CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT
  COUNT(*) AS total_invoices,
  COALESCE(SUM(total), 0) AS total_sales,
  COALESCE(SUM(total) FILTER (WHERE invoice_date = CURRENT_DATE), 0) AS sales_today,
  COALESCE(SUM(total) FILTER (WHERE invoice_date >= DATE_TRUNC('week', CURRENT_DATE)), 0) AS sales_week,
  COALESCE(SUM(total) FILTER (WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS sales_month,
  COALESCE(SUM(total) FILTER (WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS sales_year
FROM invoices
WHERE status != 'CANCELLED';

CREATE OR REPLACE VIEW vw_accounts_receivable AS
SELECT
  c.id AS client_id,
  c.full_name AS client_name,
  COALESCE(SUM(i.total), 0) AS total_invoiced,
  COALESCE(SUM(i.amount_paid), 0) AS total_paid,
  COALESCE(SUM(i.balance_due), 0) AS total_pending,
  c.credit_balance
FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id AND i.status != 'CANCELLED'
GROUP BY c.id, c.full_name, c.credit_balance;

CREATE OR REPLACE VIEW vw_inventory_value AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.code,
  COALESCE(i.stock, 0) AS stock,
  COALESCE(i.average_cost, 0) AS average_cost,
  COALESCE(i.inventory_value, 0) AS total_value,
  CASE
    WHEN COALESCE(i.stock, 0) = 0 THEN 'AGOTADO'
    WHEN COALESCE(i.stock, 0) <= COALESCE(i.minimum_stock, 3) THEN 'BAJO'
    ELSE 'SUFICIENTE'
  END AS stock_status
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.active = true;

CREATE OR REPLACE VIEW vw_top_products AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.code,
  SUM(ii.quantity) AS total_sold,
  SUM(ii.line_total) AS total_revenue
FROM invoice_items ii
JOIN products p ON p.id = ii.product_id
JOIN invoices i ON i.id = ii.invoice_id AND i.status != 'CANCELLED'
GROUP BY p.id, p.name, p.code
ORDER BY total_sold DESC;

CREATE OR REPLACE VIEW vw_top_clients AS
SELECT
  c.id AS client_id,
  c.full_name AS client_name,
  COUNT(DISTINCT i.id) AS total_purchases,
  COALESCE(SUM(i.total), 0) AS total_invoiced
FROM clients c
JOIN invoices i ON i.client_id = c.id AND i.status != 'CANCELLED'
GROUP BY c.id, c.full_name
ORDER BY total_invoiced DESC;

CREATE OR REPLACE VIEW vw_pv_summary AS
SELECT
  COALESCE(SUM(pv_total), 0) AS pv_month,
  COALESCE(SUM(pv_total) FILTER (WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS pv_year
FROM invoices
WHERE status != 'CANCELLED'
  AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE);

CREATE OR REPLACE VIEW vw_profitability AS
SELECT
  COALESCE(SUM(i.total), 0) AS total_sales,
  COALESCE(SUM(ii.unit_cost * ii.quantity), 0) AS total_costs,
  COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS total_expenses,
  COALESCE((SELECT SUM(amount) FROM bonuses WHERE bonus_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS total_bonuses,
  COALESCE(SUM(i.total), 0) - COALESCE(SUM(ii.unit_cost * ii.quantity), 0) AS gross_profit,
  COALESCE(SUM(i.total), 0) - COALESCE(SUM(ii.unit_cost * ii.quantity), 0) -
    COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) -
    COALESCE((SELECT SUM(amount) FROM bonuses WHERE bonus_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS real_profit
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.status != 'CANCELLED'
  AND i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política base: solo usuarios autenticados
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);

-- Clientes: políticas explícitas para cada operación
DROP POLICY IF EXISTS "Users can read all clients" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (auth.role() = 'authenticated');

-- Productos: políticas explícitas
DROP POLICY IF EXISTS "Users can read all products" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Demás tablas: políticas explícitas
DROP POLICY IF EXISTS "authenticated_access" ON inventory;
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_access" ON inventory_movements;
CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_access" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_access" ON invoice_items;
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_access" ON receipts;
CREATE POLICY "receipts_select" ON receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "receipts_insert" ON receipts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "receipts_update" ON receipts FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_access" ON credit_balances;
CREATE POLICY "credit_balances_select" ON credit_balances FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "credit_balances_insert" ON credit_balances FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "credit_balances_update" ON credit_balances FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON followups FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON expenses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON bonuses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON bank_accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON suppliers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON purchases FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON purchase_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_access" ON communications FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA INICIAL
-- ============================================================

INSERT INTO settings (business_name, default_margin, invoice_prefix, receipt_prefix, purchase_prefix)
VALUES ('Almaia RD', 30, 'FAC-', 'REC-', 'COM-');

INSERT INTO bank_accounts (bank_name, account_type, account_number, holder_name, is_default)
VALUES ('Banco Popular Dominicano', 'Cuenta Corriente DOP', '772922126', 'Yrahisa Mateo', true);

INSERT INTO subbrands (name) VALUES
  ('Nutrilite'), ('XS'), ('Artistry'), ('Glister'), ('G&H'),
  ('Satinique'), ('Body Series'), ('Amway Home'), ('HYMM'), ('eSpring');

INSERT INTO categories (name) VALUES
  ('Vitaminas'), ('Proteínas'), ('Energía'), ('Maquillaje'), ('Skin Care'),
  ('Cuidado Personal'), ('Fragancias'), ('Hogar'), ('Purificación de Agua');

INSERT INTO client_tags (name) VALUES
  ('Cliente Nuevo'), ('Cliente Frecuente'), ('Cliente VIP'),
  ('Cliente Nutrilite'), ('Cliente Artistry'), ('Cliente XS'), ('Cliente Inactivo');


-- ============================================================
-- PATCH: Tablas y columnas faltantes (WhatsApp, Compras, etc.)
-- Ejecutar después del schema principal
-- ============================================================

-- WhatsApp configs
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id UUID PRIMARY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  verify_token TEXT DEFAULT '',
  business_account_id TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES whatsapp_configs(id) ON DELETE CASCADE,
  to TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  template_name TEXT,
  status TEXT DEFAULT 'sent',
  message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage whatsapp_configs"
  ON whatsapp_configs FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage whatsapp_logs"
  ON whatsapp_logs FOR ALL USING (auth.role() = 'authenticated');

-- Columnas faltantes en purchases
DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_name TEXT;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS itbis NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo';
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna faltante en purchase_items
DO $$ BEGIN
  ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS line_itbis NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS itbis BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columnas faltantes en suppliers
DO $$ BEGIN
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columnas faltantes en settings
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_name TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_template TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columnas faltantes en invoices e invoice_items
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS itbis_total NUMERIC(12,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS itbis BOOLEAN DEFAULT false;
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS itbis_amount NUMERIC(12,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna faltante en settings
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS nutrilite_itbis_enabled BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna para productos manuales en invoice_items (sin product_id)
DO $$ BEGIN
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS custom_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna para fecha editable en recibos
DO $$ BEGIN
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna para productos vendidos sin stock disponible (pendiente de devolución)
DO $$ BEGIN
  ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pending_return INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Eliminar triggers que calculan/ajustan valores automáticamente
-- Ahora se gestionan desde TypeScript para mayor control
DROP TRIGGER IF EXISTS trg_calculate_prices ON products;
DROP FUNCTION IF EXISTS fn_calculate_product_prices();

DROP TRIGGER IF EXISTS trg_sale_inventory ON invoice_items;
DROP FUNCTION IF EXISTS fn_update_inventory_on_sale();

DROP TRIGGER IF EXISTS trg_purchase_inventory ON purchase_items;
DROP FUNCTION IF EXISTS fn_update_inventory_on_purchase();

DROP TRIGGER IF EXISTS trg_cancellation_restore ON invoices;
DROP FUNCTION IF EXISTS fn_restore_inventory_on_cancellation();

-- Recalcular inventario desde cero basado en compras y ventas reales
UPDATE inventory SET stock = 0, pending_return = 0, inventory_value = 0;

WITH purchased AS (
  SELECT pi.product_id, SUM(pi.quantity)::int AS qty, SUM(pi.line_total) AS val
  FROM purchase_items pi
  JOIN purchases p ON p.id = pi.purchase_id AND p.status != 'CANCELLED'
  GROUP BY pi.product_id
),
sold AS (
  SELECT ii.product_id, SUM(ii.quantity)::int AS qty
  FROM invoice_items ii
  JOIN invoices inv ON inv.id = ii.invoice_id AND inv.status != 'CANCELLED'
  WHERE ii.product_id IS NOT NULL
  GROUP BY ii.product_id
)
UPDATE inventory i SET
  stock = CASE WHEN COALESCE(p.qty, 0) > 0 THEN GREATEST(0, COALESCE(p.qty, 0) - COALESCE(s.qty, 0)) ELSE 0 END,
  pending_return = CASE WHEN COALESCE(p.qty, 0) = 0 THEN COALESCE(s.qty, 0) ELSE 0 END,
  inventory_value = COALESCE(p.val, 0)
FROM purchased p
FULL JOIN sold s ON p.product_id = s.product_id
WHERE i.product_id = COALESCE(p.product_id, s.product_id);

-- RPC: use_credit_balance
CREATE OR REPLACE FUNCTION use_credit_balance(p_credit_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_balances
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_credit_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado o saldo insuficiente';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Columna para controlar ITBIS por producto
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS apply_itbis BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Aplicar valor por defecto: Nutrilite sin ITBIS (excepto Proteína Vegetal)
UPDATE products SET apply_itbis = true WHERE apply_itbis IS NULL;
UPDATE products SET apply_itbis = false WHERE subbrand_id IN (SELECT id FROM subbrands WHERE name = 'Nutrilite') AND name NOT ILIKE '%proteína vegetal%' AND apply_itbis IS DISTINCT FROM false;

-- Nuevos campos en purchases
DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS impuesto_recogida NUMERIC(12,2) DEFAULT 36;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cargo_administracion NUMERIC(12,2) DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
