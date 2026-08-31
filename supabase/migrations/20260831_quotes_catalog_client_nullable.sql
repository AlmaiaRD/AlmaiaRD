-- ============================================================================
-- FIX: permitir cotizaciones 'Catálogo' sin cliente (para guardar un catálogo
-- como cotización pendiente de completar cuando el cliente apruebe).
-- Fecha: 2026-08-31
--
-- El campo client_id pasa a ser NULLABLE (mantiene la FK con clients, por lo
-- que un valor NULL es válido). Así un Catálogo guardado NO exige cliente desde
-- el inicio; al editarlo en Cotizaciones se le asigna el cliente y el resto de
-- detalles.
-- Idempotente: se puede ejecutar varias veces. Ejecutar una vez en SQL Editor.
-- ============================================================================

ALTER TABLE public.quotes ALTER COLUMN client_id DROP NOT NULL;
