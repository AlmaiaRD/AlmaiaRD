-- Fase 3: Centro de Comunicaciones
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'whatsapp')),
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('outgoing', 'incoming')),
  subject TEXT,
  body TEXT,
  document_type TEXT CHECK (document_type IN ('invoice', 'receipt')),
  document_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_access" ON communications;
CREATE POLICY "authenticated_access" ON communications FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
