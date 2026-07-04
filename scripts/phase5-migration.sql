-- Migration for product duration, AI prompts, and learning notes
-- Run in Supabase SQL Editor

-- 1. Add duracion_dias to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS duracion_dias INTEGER;

-- 2. Add AI prompt fields to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS ai_client_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_learning_prompt TEXT;

-- 3. Create learning_notes table (optional - using localStorage for now)
-- CREATE TABLE IF NOT EXISTS learning_notes (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   title TEXT NOT NULL,
--   content TEXT,
--   tags TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- ALTER TABLE learning_notes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage their own learning notes" ON learning_notes
--   FOR ALL USING (auth.role() = 'authenticated');

-- 4. Update default settings row with AI prompts (if exists)
UPDATE settings SET 
  ai_client_prompt = COALESCE(ai_client_prompt, 
    'Eres un asesor de ventas de Amway. Genera un análisis breve en español para el vendedor sobre este cliente:

Cliente: {{clientName}}
Etapa: {{stage}}
Total facturado: RD${{totalSpent}}
Deuda pendiente: RD${{pendingBalance}}
Compras realizadas: {{numPurchases}}
Productos favoritos: {{topProducts}}

Responde SOLO en este formato (máximo 4 líneas):
RESUMEN: [2 oraciones sobre el cliente]
ABORDAJE: [1 sugerencia de cómo contactarlo y qué ofrecerle]'),
  ai_learning_prompt = COALESCE(ai_learning_prompt,
    'Eres un coach de negocios. Basado en esta nota de aprendizaje, genera una reflexión útil y un consejo práctico:

Título: {{title}}
Contenido: {{content}}
Etiquetas: {{tags}}

Responde en español en máximo 3 oraciones:')
WHERE id = (SELECT id FROM settings LIMIT 1);