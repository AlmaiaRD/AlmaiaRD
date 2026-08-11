-- =============================================
-- MIGRACIÓN: Bundles (combos de productos)
-- Fecha: 2026-08-10
--
-- Un bundle es un producto (products.is_bundle = true) compuesto por
-- varios productos del catálogo. Su composición se guarda en bundle_items.
-- El bundle se vende a un PRECIO ESPECIAL fijado manualmente.
--
-- RLS: se habilita con las mismas políticas por rol que el resto de tablas.
-- =============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_items_unique
  ON bundle_items(bundle_id, product_id);

ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundle_items_select" ON bundle_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "bundle_items_insert" ON bundle_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "bundle_items_update" ON bundle_items
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "bundle_items_delete" ON bundle_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- Uso: SELECT * FROM public.bundle_items WHERE bundle_id = '<id>';
-- SELECT * FROM public.products WHERE is_bundle = true;
