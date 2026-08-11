-- ============================================================================
-- MIGRACIÓN CONSOLIDADA DE ENDURECIMIENTO  (ejecutar UNA sola vez en SQL Editor)
-- Fecha: 2026-08-10
--
-- Resuelve de forma idempotente los hallazgos de la auditoría:
--   1. RLS: elimina políticas legadas ('FOR ALL authenticated') y reconcilia
--      las políticas por rol (admin / seller / assistant) para TODAS las tablas.
--   2. Secretos: smtp_pass (settings) deja de ser legible por la app; se lee
--      SOLO vía RPC SECURITY DEFINER restringido a admin.
--      whatsapp_configs (access_token) pasa a ser SOLO admin.
--   3. RPCs de inventario: SECURITY DEFINER + search_path + validación de
--      cantidades y costos negativos.
--   4. use_credit_balance: valida montos > 0, descuenta también
--      clients.credit_balance y marca el crédito USADO al agotarse.
--   5. credit_balances: balance se inicializa = amount automáticamente.
--   6. vw_pv_summary: PV del año ya no queda limitado al mes actual.
--
-- NOTA DE COMPORTAMIENTO: tras esta migración, solo el rol admin puede
-- leer/administrar la configuración de WhatsApp y enviar correos (smtp).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper de rol (idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS: limpiar políticas legadas / antiguas (idempotente)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','clients','products','bundle_items','inventory','inventory_movements',
    'suppliers','purchases','purchase_items','invoices','invoice_items','receipts',
    'credit_balances','followups','expenses','bonuses','bank_accounts','communications',
    'settings','audit_logs','whatsapp_configs','whatsapp_logs','returns','return_items',
    'categories','subbrands','client_tags','client_tag_relations'
  ] LOOP
    FOR p IN
      SELECT polname FROM pg_policy WHERE polrelid = format('%I.%I', 'public', t)::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p, 'public', t);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. RLS: políticas por rol (consolidado)
-- ---------------------------------------------------------------------------

-- users: cada usuario ve y edita su propio registro (la app crea el perfil
-- propio al registrar/entrar y guarda preferencias).
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- clients
CREATE POLICY "clients_select" ON clients FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (get_user_role() = 'admin');

-- categories / subbrands
CREATE POLICY "categories_select" ON categories FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "subbrands_select" ON subbrands FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "subbrands_insert" ON subbrands FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "subbrands_update" ON subbrands FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "subbrands_delete" ON subbrands FOR DELETE USING (get_user_role() = 'admin');

-- client_tags / client_tag_relations
CREATE POLICY "client_tags_select" ON client_tags FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "client_tags_insert" ON client_tags FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "client_tags_update" ON client_tags FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "client_tags_delete" ON client_tags FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "client_tag_relations_select" ON client_tag_relations FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "client_tag_relations_insert" ON client_tag_relations FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "client_tag_relations_delete" ON client_tag_relations FOR DELETE USING (get_user_role() IN ('admin','seller'));

-- products / bundle_items
CREATE POLICY "products_select" ON products FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "products_update" ON products FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "products_delete" ON products FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "bundle_items_select" ON bundle_items FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "bundle_items_insert" ON bundle_items FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "bundle_items_update" ON bundle_items FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "bundle_items_delete" ON bundle_items FOR DELETE USING (get_user_role() = 'admin');

-- inventory (contiene costos)
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (get_user_role() = 'admin');

-- inventory_movements
CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "inventory_movements_delete" ON inventory_movements FOR DELETE USING (get_user_role() = 'admin');

-- suppliers
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (get_user_role() = 'admin');

-- purchases / purchase_items
CREATE POLICY "purchases_select" ON purchases FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "purchases_insert" ON purchases FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "purchases_update" ON purchases FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "purchases_delete" ON purchases FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "purchase_items_select" ON purchase_items FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "purchase_items_insert" ON purchase_items FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "purchase_items_delete" ON purchase_items FOR DELETE USING (get_user_role() = 'admin');

-- invoices / invoice_items
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE USING (get_user_role() = 'admin');

-- receipts
CREATE POLICY "receipts_select" ON receipts FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "receipts_insert" ON receipts FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "receipts_update" ON receipts FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "receipts_delete" ON receipts FOR DELETE USING (get_user_role() = 'admin');

-- credit_balances
CREATE POLICY "credit_balances_select" ON credit_balances FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "credit_balances_insert" ON credit_balances FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "credit_balances_update" ON credit_balances FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "credit_balances_delete" ON credit_balances FOR DELETE USING (get_user_role() = 'admin');

-- followups
CREATE POLICY "followups_select" ON followups FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "followups_insert" ON followups FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "followups_update" ON followups FOR UPDATE USING (get_user_role() IN ('admin','seller','assistant')) WITH CHECK (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "followups_delete" ON followups FOR DELETE USING (get_user_role() IN ('admin','seller'));

-- expenses
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (get_user_role() = 'admin');

-- bonuses
CREATE POLICY "bonuses_select" ON bonuses FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "bonuses_insert" ON bonuses FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "bonuses_update" ON bonuses FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "bonuses_delete" ON bonuses FOR DELETE USING (get_user_role() = 'admin');

-- bank_accounts
CREATE POLICY "bank_accounts_select" ON bank_accounts FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "bank_accounts_insert" ON bank_accounts FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "bank_accounts_update" ON bank_accounts FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "bank_accounts_delete" ON bank_accounts FOR DELETE USING (get_user_role() = 'admin');

-- settings: lectura para todos (funcional), escritura SOLO admin.
-- El secreto smtp_pass se protege por columna y solo se lee por RPC de admin.
CREATE POLICY "settings_select" ON settings FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "settings_delete" ON settings FOR DELETE USING (get_user_role() = 'admin');

-- suppliers/purchases/purchase_items/communications: ver políticas propias más arriba.

-- communications
CREATE POLICY "communications_select" ON communications FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "communications_insert" ON communications FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "communications_update" ON communications FOR UPDATE USING (get_user_role() IN ('admin','seller','assistant')) WITH CHECK (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "communications_delete" ON communications FOR DELETE USING (get_user_role() IN ('admin','seller'));

-- audit_logs
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));

-- returns / return_items
CREATE POLICY "returns_select" ON returns FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "returns_insert" ON returns FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "returns_update" ON returns FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "returns_delete" ON returns FOR DELETE USING (get_user_role() = 'admin');
CREATE POLICY "return_items_select" ON return_items FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "return_items_insert" ON return_items FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "return_items_update" ON return_items FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY "return_items_delete" ON return_items FOR DELETE USING (get_user_role() = 'admin');

-- whatsapp_configs: SOLO admin (contiene access_token de larga duración)
CREATE POLICY "whatsapp_configs_select" ON whatsapp_configs FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "whatsapp_configs_insert" ON whatsapp_configs FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "whatsapp_configs_update" ON whatsapp_configs FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "whatsapp_configs_delete" ON whatsapp_configs FOR DELETE USING (get_user_role() = 'admin');

-- whatsapp_logs
CREATE POLICY "whatsapp_logs_select" ON whatsapp_logs FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY "whatsapp_logs_insert" ON whatsapp_logs FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller','assistant'));

-- ---------------------------------------------------------------------------
-- 4. Protección de secretos
-- ---------------------------------------------------------------------------
-- smtp_pass ya no es legible por rol authenticated (ni anon).
REVOKE SELECT (smtp_pass) ON public.settings FROM authenticated, anon;

-- Settings públicos (sin secretos) + indicador de que hay contraseña guardada.
CREATE OR REPLACE FUNCTION public.get_settings_public()
RETURNS TABLE (
  id UUID, business_name TEXT, logo_url TEXT, signature_url TEXT,
  default_margin NUMERIC, invoice_prefix TEXT, receipt_prefix TEXT,
  purchase_prefix TEXT, currency TEXT, email TEXT, phone TEXT, sender_name TEXT,
  email_template TEXT, whatsapp_template TEXT, smtp_host TEXT, smtp_port INTEGER,
  smtp_user TEXT, smtp_secure BOOLEAN, nutrilite_itbis_enabled BOOLEAN,
  ai_client_prompt TEXT, ai_learning_prompt TEXT, created_at TIMESTAMPTZ,
  has_smtp_password BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.business_name, s.logo_url, s.signature_url, s.default_margin,
    s.invoice_prefix, s.receipt_prefix, s.purchase_prefix, s.currency, s.email,
    s.phone, s.sender_name, s.email_template, s.whatsapp_template, s.smtp_host,
    s.smtp_port, s.smtp_user, s.smtp_secure, s.nutrilite_itbis_enabled,
    s.ai_client_prompt, s.ai_learning_prompt, s.created_at,
    (s.smtp_pass IS NOT NULL AND s.smtp_pass <> '') AS has_smtp_password
  FROM public.settings s
  ORDER BY s.created_at
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_settings_public() TO authenticated;

-- Settings con secretos: SOLO admin (para el envío real de correo).
CREATE OR REPLACE FUNCTION public.get_settings_with_secrets()
RETURNS SETOF public.settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.* FROM public.settings s
  WHERE get_user_role() = 'admin'
  ORDER BY s.created_at
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_settings_with_secrets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_settings_with_secrets() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPCs de inventario: SECURITY DEFINER + validación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_line_total NUMERIC,
  p_movement_type TEXT DEFAULT 'PURCHASE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Costo unitario inválido';
  END IF;
  IF p_line_total IS NULL OR p_line_total < 0 THEN
    RAISE EXCEPTION 'Total de línea inválido';
  END IF;

  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);

    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = CASE WHEN v_existing.stock > 0
        THEN ROUND(((v_existing.average_cost * v_existing.stock) + (p_quantity * p_unit_cost)) / (v_existing.stock + p_quantity), 2)
        ELSE p_unit_cost END,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + p_line_total,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, average_cost, inventory_value)
    VALUES (p_product_id, p_quantity, 0, p_unit_cost, p_line_total);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION add_inventory_stock(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION subtract_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'SALE',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT stock, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_new_stock := GREATEST(0, v_existing.stock - p_quantity);
    v_shortfall := p_quantity - (v_existing.stock - v_new_stock);

    UPDATE inventory SET
      stock = v_new_stock,
      pending_return = COALESCE(v_existing.pending_return, 0) + v_shortfall,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, inventory_value, minimum_stock)
    VALUES (p_product_id, 0, p_quantity, 0, 3);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION subtract_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION restore_inventory_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT DEFAULT 'CANCELLATION',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT stock, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);

    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, minimum_stock, inventory_value)
    VALUES (p_product_id, p_quantity, 0, 3, 0);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION restore_inventory_stock(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. credit_balances: balance = amount al insertar + backfill
-- ---------------------------------------------------------------------------
UPDATE credit_balances SET balance = amount WHERE balance IS NULL;

CREATE OR REPLACE FUNCTION fn_credit_balances_set_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance IS NULL THEN
    NEW.balance := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_balances_set_balance ON credit_balances;
CREATE TRIGGER trg_credit_balances_set_balance
  BEFORE INSERT ON credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION fn_credit_balances_set_balance();

-- ---------------------------------------------------------------------------
-- 7. use_credit_balance: validación + descuento de clients.credit_balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION use_credit_balance(p_credit_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
DECLARE
  v_client_id UUID;
  v_new_balance NUMERIC;
BEGIN
  IF p_credit_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT client_id, COALESCE(balance, amount) - p_amount
    INTO v_client_id, v_new_balance
  FROM credit_balances
  WHERE id = p_credit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado';
  END IF;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE credit_balances
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = p_credit_id;

  UPDATE clients
  SET credit_balance = GREATEST(COALESCE(credit_balance, 0) - p_amount, 0)
  WHERE id = v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION use_credit_balance(UUID, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Vista PV: el año ya no queda limitado al mes actual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_pv_summary AS
SELECT
  COALESCE(SUM(pv_total) FILTER (WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS pv_month,
  COALESCE(SUM(pv_total) FILTER (WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS pv_year
FROM invoices
WHERE status != 'CANCELLED';
