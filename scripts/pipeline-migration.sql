-- Fase 0: Pipeline - Nuevas columnas para ciclo de vida del cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'lead';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_contact_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS interest TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_followup_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contact_date DATE;
