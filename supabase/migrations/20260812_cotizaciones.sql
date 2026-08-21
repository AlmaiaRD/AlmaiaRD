-- ============================================================
-- Cotizaciones: quotes + quote_items + seguimiento automático
-- Las cotizaciones NO descuentan inventario, NO se asocian a
-- ventas y NO afectan ganancias (vw_profitability se alimenta
-- solo de facturas/recibos).
-- ============================================================

-- 0) Seguridad: get_settings_with_secrets solo se usa server-side
--    (route /api/send-email). La protección real es el check
--    get_user_role()='admin' interno; se revoca también a anon.
REVOKE EXECUTE ON FUNCTION public.get_settings_with_secrets() FROM anon;

-- 1) Prefijo de numeración de cotizaciones
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS quote_prefix text NOT NULL DEFAULT 'COT-';

-- 2) Encabezado de cotización
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED','CANCELLED','CONVERTED')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  itbis_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  pv_total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  margin integer NOT NULL DEFAULT 30,
  sent_at timestamptz,
  converted_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id),
  updated_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Líneas de la cotización (misma forma que invoice_items)
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  pv numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  itbis boolean NOT NULL DEFAULT false,
  itbis_amount numeric(12,2) NOT NULL DEFAULT 0,
  custom_name text
);

-- 4) Trazabilidad del seguimiento: las actividades del CRM pueden
--    referenciar la cotización que las generó.
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE;

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items(product_id);
CREATE INDEX IF NOT EXISTS idx_followups_quote_id ON public.followups(quote_id);

-- 6) RLS: mismo rol que el resto de tablas operativas
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotes_select ON public.quotes;
DROP POLICY IF EXISTS quotes_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_update ON public.quotes;
DROP POLICY IF EXISTS quotes_delete ON public.quotes;
DROP POLICY IF EXISTS quote_items_select ON public.quote_items;
DROP POLICY IF EXISTS quote_items_insert ON public.quote_items;
DROP POLICY IF EXISTS quote_items_update ON public.quote_items;
DROP POLICY IF EXISTS quote_items_delete ON public.quote_items;

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE USING (get_user_role() IN ('admin','seller'))
  WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE USING (get_user_role() = 'admin');

CREATE POLICY quote_items_select ON public.quote_items
  FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));
CREATE POLICY quote_items_insert ON public.quote_items
  FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY quote_items_update ON public.quote_items
  FOR UPDATE USING (get_user_role() IN ('admin','seller'))
  WITH CHECK (get_user_role() IN ('admin','seller'));
CREATE POLICY quote_items_delete ON public.quote_items
  FOR DELETE USING (get_user_role() IN ('admin','seller'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO anon, authenticated, service_role;

-- 7) Seguimiento automático: al marcar una cotización como ENVIADA
--    se crean 3 actividades PENDING a +3/+5/+10 días (una sola vez).
CREATE OR REPLACE FUNCTION public.fn_quote_sent_followups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_date date;
  exists_count integer;
BEGIN
  IF NEW.status = 'SENT' AND NEW.quote_number IS NOT NULL THEN
    base_date := COALESCE((NEW.sent_at AT TIME ZONE 'America/Santo_Domingo')::date, NEW.quote_date, CURRENT_DATE);
    SELECT count(*) INTO exists_count FROM public.followups WHERE quote_id = NEW.id;
    IF exists_count = 0 THEN
      INSERT INTO public.followups (client_id, contact_date, comments, status, quote_id) VALUES
        (NEW.client_id, base_date + 3,  '[Seguimiento de cotización] Seguimiento cotización ' || NEW.quote_number || ' (día 3)',  'PENDING', NEW.id),
        (NEW.client_id, base_date + 5,  '[Seguimiento de cotización] Seguimiento cotización ' || NEW.quote_number || ' (día 5)',  'PENDING', NEW.id),
        (NEW.client_id, base_date + 10, '[Seguimiento de cotización] Seguimiento cotización ' || NEW.quote_number || ' (día 10)', 'PENDING', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_sent_followups ON public.quotes;
CREATE TRIGGER trg_quote_sent_followups
  AFTER INSERT OR UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_quote_sent_followups();
