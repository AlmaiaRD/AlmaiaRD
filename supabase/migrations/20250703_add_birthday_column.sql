-- =============================================
-- MIGRACIÓN: Agregar columna birthday a clients
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Agregar columna birthday
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday DATE;
