-- F4: Persistencia de webhook de WhatsApp
-- Estados sent/delivered/read en whatsapp_logs + mensajes entrantes.

ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outgoing',
  ADD COLUMN IF NOT EXISTS message_body text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamp with time zone;

COMMENT ON COLUMN public.whatsapp_logs.direction IS 'outgoing = enviado por nosotros, incoming = recibido vía webhook';
COMMENT ON COLUMN public.whatsapp_logs.message_body IS 'Cuerpo del mensaje entrante (solo para dirección incoming)';

CREATE INDEX IF NOT EXISTS whatsapp_logs_message_id_idx ON public.whatsapp_logs (message_id);
CREATE INDEX IF NOT EXISTS whatsapp_logs_direction_idx ON public.whatsapp_logs (direction);
