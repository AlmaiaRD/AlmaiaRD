-- Reload PostgREST schema cache so it picks up the quote_items FK to products
-- This is needed because quote_items was created in a later migration and
-- PostgREST didn't detect the FK relationships at startup.
SELECT pg_notify('pgrst', 'reload schema');
