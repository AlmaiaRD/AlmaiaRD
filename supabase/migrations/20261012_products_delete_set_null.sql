-- Permitir borrar productos sin borrar facturas/compras/devoluciones históricas.
-- Las líneas conservan sus datos (nombre, precio, cantidad) pero product_id pasa a NULL.

-- 1) return_items.product_id es NOT NULL → hacerlo nullable
ALTER TABLE public.return_items
  ALTER COLUMN product_id DROP NOT NULL;

-- 2) Cambiar FKs a ON DELETE SET NULL
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_product_id_fkey,
  ADD CONSTRAINT invoice_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;

ALTER TABLE public.purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey,
  ADD CONSTRAINT purchase_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;

ALTER TABLE public.return_items
  DROP CONSTRAINT IF EXISTS return_items_product_id_fkey,
  ADD CONSTRAINT return_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;

-- 3) bundle_items ya tiene ON DELETE CASCADE (ok, se borra en cascada)
-- inventory / inventory_movements ya tienen ON DELETE CASCADE (ok)