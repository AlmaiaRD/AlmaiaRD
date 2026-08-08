CREATE OR REPLACE FUNCTION add_inventory_stock(p_product_id UUID, p_quantity NUMERIC, p_unit_cost NUMERIC, p_line_total NUMERIC)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
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
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION subtract_inventory_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
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
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_inventory_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
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
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION adjust_invoice_payment(p_invoice_id UUID, p_diff NUMERIC)
RETURNS void AS $$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT total, amount_paid INTO v_invoice
  FROM invoices WHERE id = p_invoice_id;
  
  v_new_paid := COALESCE(v_invoice.amount_paid, 0) + p_diff;
  v_new_balance := v_invoice.total - v_new_paid;
  
  UPDATE invoices SET
    amount_paid = v_new_paid,
    balance_due = GREATEST(v_new_balance, 0),
    status = CASE
      WHEN v_new_balance <= 0 THEN 'PAID'
      WHEN v_new_paid > 0 THEN 'PARTIAL'
      ELSE 'PENDING'
    END
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;