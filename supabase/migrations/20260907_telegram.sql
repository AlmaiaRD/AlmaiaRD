-- F2.1: Telegram — configuración del bot + registro de mensajes.
-- Estructura espejo de whatsapp_configs/whatsapp_logs para consistencia.
-- El bot_token es secreto: nunca sale del servidor (RLS admin-only).
-- telegram_logs guarda tanto salientes como entrantes (webhook) y, junto con
-- clients.telegram_chat_id, habilita el Modelo B (avisos al cliente).

CREATE TABLE IF NOT EXISTS public.telegram_configs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  label text NOT NULL,
  bot_token text NOT NULL,
  webhook_secret text,
  owner_chat_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  config_id uuid,
  chat_id text NOT NULL,
  direction text NOT NULL DEFAULT 'outgoing',
  message_type text NOT NULL DEFAULT 'text',
  message_body text,
  status text DEFAULT 'sent'::text,
  message_id text,
  error text,
  status_updated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- chat_id del cliente para Modelo B (avisos directos al cliente por Telegram).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

ALTER TABLE ONLY public.telegram_configs ADD CONSTRAINT telegram_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.telegram_logs ADD CONSTRAINT telegram_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.telegram_logs ADD CONSTRAINT telegram_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.telegram_configs(id);

CREATE INDEX IF NOT EXISTS telegram_logs_config_id_idx ON public.telegram_logs (config_id);
CREATE INDEX IF NOT EXISTS telegram_logs_chat_id_idx ON public.telegram_logs (chat_id);
CREATE INDEX IF NOT EXISTS telegram_logs_message_id_idx ON public.telegram_logs (message_id);
CREATE INDEX IF NOT EXISTS telegram_logs_direction_idx ON public.telegram_logs (direction);

-- ---------------------------------------------------------------------------
-- RLS: configs SOLO admin (como whatsapp_configs); logs visibles al equipo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.telegram_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_configs_select ON public.telegram_configs;
CREATE POLICY "telegram_configs_select" ON public.telegram_configs
  FOR SELECT USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS telegram_configs_insert ON public.telegram_configs;
CREATE POLICY "telegram_configs_insert" ON public.telegram_configs
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS telegram_configs_update ON public.telegram_configs;
CREATE POLICY "telegram_configs_update" ON public.telegram_configs
  FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS telegram_configs_delete ON public.telegram_configs;
CREATE POLICY "telegram_configs_delete" ON public.telegram_configs
  FOR DELETE USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS telegram_logs_select ON public.telegram_logs;
CREATE POLICY "telegram_logs_select" ON public.telegram_logs
  FOR SELECT USING (get_user_role() IN ('admin','seller','assistant'));

DROP POLICY IF EXISTS telegram_logs_insert ON public.telegram_logs;
CREATE POLICY "telegram_logs_insert" ON public.telegram_logs
  FOR INSERT WITH CHECK (get_user_role() IN ('admin','seller','assistant'));

DROP POLICY IF EXISTS telegram_logs_update ON public.telegram_logs;
CREATE POLICY "telegram_logs_update" ON public.telegram_logs
  FOR UPDATE USING (get_user_role() IN ('admin','seller','assistant')) WITH CHECK (get_user_role() IN ('admin','seller','assistant'));

REVOKE ALL ON public.telegram_configs FROM anon;
REVOKE ALL ON public.telegram_logs FROM anon;
REVOKE ALL ON public.telegram_configs FROM authenticated;
REVOKE ALL ON public.telegram_logs FROM authenticated;
GRANT SELECT ON public.telegram_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.telegram_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC pública: datos sin secretos (has_token, no bot_token).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_telegram_configs_public()
RETURNS TABLE (
  id UUID, label TEXT, owner_chat_id TEXT, is_active BOOLEAN,
  created_at TIMESTAMPTZ, has_token BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT t.id, t.label, t.owner_chat_id, t.is_active, t.created_at,
         (t.bot_token IS NOT NULL AND t.bot_token <> '')
  FROM public.telegram_configs t
  WHERE get_user_role() IN ('admin','seller','assistant')
  ORDER BY t.created_at DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.get_telegram_configs_public() TO authenticated;