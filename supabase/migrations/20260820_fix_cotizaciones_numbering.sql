-- ============================================================
-- Fix: crear RPC get_next_quote_number + fn_generate_quote_number
-- Resuelve el bug crítico donde createQuote inserta
-- quote_number: null en una columna NOT NULL UNIQUE.
-- ============================================================

-- 1) Función generadora de número de cotización (misma lógica que invoices/receipts/purchases)
CREATE OR REPLACE FUNCTION public.fn_generate_quote_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(quote_prefix, 'COT-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(quote_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM quotes WHERE quote_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

-- 2) RPC callable from the client to get next quote number
CREATE OR REPLACE FUNCTION public.get_next_quote_number(p_prefix text DEFAULT 'COT-')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(p_prefix, 'COT-') INTO prefix;
  SELECT COALESCE(MAX(CAST(REPLACE(quote_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM quotes WHERE quote_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

-- 3) Permitir que authenticated y admin llamen la función
GRANT EXECUTE ON FUNCTION public.get_next_quote_number(text) TO authenticated, service_role;
