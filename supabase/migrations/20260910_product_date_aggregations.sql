-- ============================================================================
-- H3 (auditoría 02/10/2026): "última venta", "última compra" y "primera
-- compra" por producto devuelven FECHAS ALEATORIAS.
--
-- BUG ORIGINAL (`src/services/inventory.ts`)
--
--   `getLastSalePerProduct` / `getLastPurchasePerProduct` /
--   `getFirstPurchasePerProduct`aban el mismo patrón:
--
--     1. SELECT id, invoice_date FROM invoices
--        WHERE status <> 'CANCELLED'
--        ORDER BY invoice_date DESC          <- aquí sí se ordenaba por fecha
--     2. SELECT product_id, invoice_id FROM invoice_items
--        WHERE invoice_id IN (<todos los ids de (1)>)
--        ORDER BY invoice_id DESC           <- ORDENA POR UUID, NO POR FECHA
--     3. "el primer renglón de cada product_id es el último/primero"
--
--   El paso (1) sí ordenaba por fecha, pero esa información se pierde: el
--   paso (2) vuelve a ordenar por `invoice_id`, que es un UUID. El orden
--   lexicográfico de un UUID no guarda ninguna relación con la fecha de la
--   factura, de modo que el renglón retenido en el paso (3) es
--   esencialmente ALEATORIO.
--
--   Consecuencia: el módulo de inventario mostraba fechas de última venta /
--   compra incorrectas, y los indicadores derivados de ellas (rotación,
--   antigüedad) también.
--
--   Problema secundario: `.in("invoice_id", ids)` sin paginar enviaba TODOS
--   los ids de facturas en una sola petición. Con miles de facturas la URL
--   crece sin límite y la consulta falla o se agota.
--
-- CORRECCIÓN
--
--   Se delega la agregación a la base de datos con `DISTINCT ON`, que es la
--   forma canónica en PostgreSQL de "la fila más reciente por grupo":
--
--     SELECT DISTINCT ON (product_id) ... ORDER BY product_id, <fecha> DESC
--
--   Devuelve una sola fila por producto y no depende de transferir
--   datos al cliente.
--
-- POR QUÉ FUNCIONES Y NO VISTAS
--
--   Se usan funciones `STABLE SECURITY INVOKER` en lugar de vistas a
--   propósito: una vista sin `security_invoker` se ejecuta con los
--   privilegios de su propietario y saltarse las RLS de las tablas base
--   (ya es un hallazgo abierto de esta auditoría sobre las vistas existentes).
--   Con `SECURITY INVOKER` las políticas RLS de `invoices`, `invoice_items`,
--   `purchases` y `purchase_items` se siguen aplicando.
--
--
-- DESEMPATE
--
--   Se añade `ii.id` / `pi.id` como segundo criterio para que el resultado
--   sea DETERMINISTA cuando dos renglones comparten producto y fecha.
--
-- ROLLBACK
--
--   Eliminar estas tres funciones y volver a la lógica de cliente. No se
--   toca ninguna tabla ni ninguna fórmula de negocio.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Última venta por producto (facturas no canceladas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_last_sale_per_product()
RETURNS TABLE (product_id UUID, last_date DATE)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT DISTINCT ON (ii.product_id)
         ii.product_id,
         i.invoice_date
  FROM public.invoice_items ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE i.status <> 'CANCELLED'
  ORDER BY ii.product_id, i.invoice_date DESC, ii.id;
$function$;

-- ---------------------------------------------------------------------------
-- Última compra por producto (compras no canceladas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_last_purchase_per_product()
RETURNS TABLE (product_id UUID, last_date DATE)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT DISTINCT ON (pi.product_id)
         pi.product_id,
         p.purchase_date
  FROM public.purchase_items pi
  JOIN public.purchases p ON p.id = pi.purchase_id
  WHERE p.status <> 'CANCELLED'
  ORDER BY pi.product_id, p.purchase_date DESC, pi.id;
$function$;

-- ---------------------------------------------------------------------------
-- Primera compra por producto (compras no canceladas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_first_purchase_per_product()
RETURNS TABLE (product_id UUID, first_date DATE)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT DISTINCT ON (pi.product_id)
         pi.product_id,
         p.purchase_date
  FROM public.purchase_items pi
  JOIN public.purchases p ON p.id = pi.purchase_id
  WHERE p.status <> 'CANCELLED'
  ORDER BY pi.product_id, p.purchase_date ASC, pi.id;
$function$;

-- ---------------------------------------------------------------------------
-- Permisos: sin esto las funciones nuevas serían ejecutables por `anon`
-- (y por extensión por el rol `PUBLIC`).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_last_sale_per_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_last_sale_per_product() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_last_sale_per_product() TO authenticated;

REVOKE ALL ON FUNCTION public.get_last_purchase_per_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_last_purchase_per_product() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_last_purchase_per_product() TO authenticated;

REVOKE ALL ON FUNCTION public.get_first_purchase_per_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_first_purchase_per_product() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_first_purchase_per_product() TO authenticated;

COMMENT ON FUNCTION public.get_last_sale_per_product() IS
  'Ultima venta (no cancelada) por producto. Reemplaza la ordenacion por UUID del cliente.';
COMMENT ON FUNCTION public.get_last_purchase_per_product() IS
  'Ultima compra (no cancelada) por producto.';
COMMENT ON FUNCTION public.get_first_purchase_per_product() IS
  'Primera compra (no cancelada) por producto.';
