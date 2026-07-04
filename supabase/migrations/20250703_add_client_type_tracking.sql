-- =============================================
-- MIGRACIÓN: Agregar columnas de historial de conversión
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Agregar columnas para rastrear cambios de tipo de cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type_changed_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS previous_client_type TEXT;
