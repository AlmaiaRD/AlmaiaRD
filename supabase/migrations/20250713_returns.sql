-- Devoluciones (Returns)

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  return_date DATE NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Secuencia para números de devolución
CREATE SEQUENCE IF NOT EXISTS return_number_seq START 1;

-- Índices
CREATE INDEX IF NOT EXISTS idx_returns_client_id ON returns (client_id);
CREATE INDEX IF NOT EXISTS idx_returns_invoice_id ON returns (invoice_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns (status);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items (return_id);
