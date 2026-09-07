-- F1.3: Plantillas de mensajes unificadas (chat: whatsapp / telegram / email).
-- Reemplaza los sistemas dispersos (localStorage del módulo WhatsApp, plantillas
-- de settings) por un único catálogo en BD con RLS para roles del negocio.

CREATE TABLE IF NOT EXISTS public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'email')),
  name text NOT NULL,
  message text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'General',
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_templates_channel_idx ON public.communication_templates (channel);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_communication_templates_touch ON public.communication_templates;
CREATE TRIGGER trg_communication_templates_touch
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: lectura/escritura para admin/seller; borrado solo admin.
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_templates_select ON public.communication_templates;
CREATE POLICY "communication_templates_select" ON public.communication_templates
  FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));

DROP POLICY IF EXISTS communication_templates_insert ON public.communication_templates;
CREATE POLICY "communication_templates_insert" ON public.communication_templates
  FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller'));

DROP POLICY IF EXISTS communication_templates_update ON public.communication_templates;
CREATE POLICY "communication_templates_update" ON public.communication_templates
  FOR UPDATE USING (get_user_role() IN ('admin','seller')) WITH CHECK (get_user_role() IN ('admin','seller'));

DROP POLICY IF EXISTS communication_templates_delete ON public.communication_templates;
CREATE POLICY "communication_templates_delete" ON public.communication_templates
  FOR DELETE USING (get_user_role() = 'admin');

REVOKE ALL ON public.communication_templates FROM anon;
REVOKE ALL ON public.communication_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_templates TO authenticated;

-- ---------------------------------------------------------------------------
-- Plantillas por defecto (mismas que usaba el sistema en localStorage).
-- Se aplican una sola vez (is_system) y el negocio puede editarlas.
-- ---------------------------------------------------------------------------

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'whatsapp', 'Enviar Factura',
  'Hola {cliente}, te envío la factura #{numero} por un total de RD${monto}. Fecha de vencimiento: {fecha}. ¡Gracias por tu compra!',
  ARRAY['cliente','numero','monto','fecha'], 'General', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Enviar Factura');

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'whatsapp', 'Recordatorio de Pago',
  'Hola {cliente}, te recordamos que tienes un saldo pendiente de RD${monto}. Fecha de vencimiento: {fecha}. Si ya realizaste el pago, ignora este mensaje.',
  ARRAY['cliente','monto','fecha'], 'General', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Recordatorio de Pago');

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'whatsapp', 'Mensaje de Bienvenida',
  '¡Bienvenido/a a Almaia RD! {cliente}, somos distribuidores autorizados Amway. Estamos aquí para ofrecerte productos de calidad para tu bienestar y salud. ¿En qué podemos ayudarte?',
  ARRAY['cliente'], 'General', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Mensaje de Bienvenida');

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'whatsapp', 'Promoción',
  '¡Hola {cliente}! 🌟 Tenemos una promoción especial para ti: {detalle}. ¡No te lo pierdas! Escríbenos para más información.',
  ARRAY['cliente','detalle'], 'Promociones', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Promoción');

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'whatsapp', 'Seguimiento',
  'Hola {cliente}, ¿cómo te fue con tu última compra? Me encantaría saber tu experiencia con los productos. ¿Hay algo en lo que pueda ayudarte?',
  ARRAY['cliente'], 'General', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Seguimiento');

INSERT INTO public.communication_templates (channel, name, message, variables, category, is_system)
SELECT 'email', 'Email de Documento',
  'Hola, {clientName}.\n\nEspero que te encuentres muy bien.\n\nTe comparto adjunta {label} correspondiente a tu transacción realizada en {businessName}.\n\nSi tienes alguna duda o necesitas asistencia, estaré encantada de ayudarte.\n\nMuchas gracias por tu confianza.\n\nSaludos,\n{senderName}',
  ARRAY['clientName','label','businessName','senderName'], 'Documentos', true
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND channel = 'email' AND name = 'Email de Documento');

-- ---------------------------------------------------------------------------
-- RPC pública para telegram_configs (aplicado en 20260907_telegram):
-- --placeholder-- (ver migración telegram para la definición real)
-- ---------------------------------------------------------------------------