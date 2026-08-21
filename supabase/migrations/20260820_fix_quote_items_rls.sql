-- Fix: allow sellers to delete quote_items (needed by updateQuote)
DROP POLICY IF EXISTS quote_items_delete ON public.quote_items;
CREATE POLICY quote_items_delete ON public.quote_items
  FOR DELETE USING (get_user_role() IN ('admin','seller'));

-- Add created_at/updated_at to quote_items for consistency
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
