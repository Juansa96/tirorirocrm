-- ══════════════════════════════════════════════════════════════════════════
-- Integración de WhatsApp Business (coexistencia app + Cloud API).
--
-- Los mensajes llegan por webhook a /api/whatsapp/webhook y se guardan aquí.
-- Una IA los lee (ver src/lib/whatsapp/procesar.server.ts), enlaza cada
-- conversación con su cliente del CRM por teléfono, rellena datos vacíos y
-- deja PROPUESTAS (cambiar de etapa, crear producto, fusionar…) que el equipo
-- acepta o rechaza con un toque desde /whatsapp. Nada de eso cambia solo.
--
-- Tablas nuevas (no se tocan las existentes). Aplicada en producción desde la
-- sesión de Claude el 23/09/2026 (Lovable no ejecuta estas migraciones solas).
-- ══════════════════════════════════════════════════════════════════════════

-- ── Configuración (una sola fila) ───────────────────────────────────────────
-- Solo la lee el servidor (service_role) y el equipo (para copiar el token en
-- el proveedor). Nadie la escribe desde la app.
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  webhook_token TEXT NOT NULL,            -- ?token= del webhook y cabecera x-whatsapp-token
  verify_token TEXT NOT NULL,             -- hub.verify_token de la verificación de Meta
  app_secret TEXT,                        -- opcional: valida X-Hub-Signature-256 si se rellena
  modelo TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  activo BOOLEAN NOT NULL DEFAULT true,   -- false = se guardan mensajes pero no se analizan
  conectado_at TIMESTAMPTZ,               -- primer evento recibido (antes = historial)
  ultimo_evento_at TIMESTAMPTZ,
  ultimo_proceso_at TIMESTAMPTZ,
  ultimo_error TEXT,
  ultimo_error_at TIMESTAMPTZ,
  numero_negocio TEXT,                    -- display_phone_number que reporta Meta
  vendedor_defecto TEXT NOT NULL DEFAULT 'rocionavarreteurdiales98@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conversaciones (una por número de WhatsApp) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono TEXT NOT NULL UNIQUE,          -- wa_id: solo dígitos con prefijo país (34…)
  nombre_wa TEXT NOT NULL DEFAULT '',     -- nombre del perfil de WhatsApp
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  -- nueva: sin cliente aún · vinculada: con cliente · no_cliente: la IA cree que
  -- no es un cliente (proveedor, spam…) · ignorada: descartada a mano
  estado TEXT NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva','vinculada','no_cliente','ignorada')),
  origen TEXT NOT NULL DEFAULT 'webhook' CHECK (origen IN ('webhook','historial')),
  resumen TEXT NOT NULL DEFAULT '',       -- resumen de la IA
  datos JSONB NOT NULL DEFAULT '{}'::jsonb, -- última extracción de la IA
  ultimo_mensaje_at TIMESTAMPTZ,
  ultimo_mensaje_entrante_at TIMESTAMPTZ,
  ultimo_analisis_at TIMESTAMPTZ,
  analizado_hasta TIMESTAMPTZ,            -- último mensaje que ya vio la IA
  mensajes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_conversaciones_lead_idx ON public.whatsapp_conversaciones(lead_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversaciones_pend_idx ON public.whatsapp_conversaciones(ultimo_mensaje_at DESC);

-- ── Mensajes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT NOT NULL UNIQUE,             -- id del mensaje en WhatsApp (idempotencia)
  conversacion_id UUID NOT NULL REFERENCES public.whatsapp_conversaciones(id) ON DELETE CASCADE,
  direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
  tipo TEXT NOT NULL DEFAULT 'text',
  texto TEXT NOT NULL DEFAULT '',
  enviado_at TIMESTAMPTZ NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_mensajes_conv_idx ON public.whatsapp_mensajes(conversacion_id, enviado_at);

-- ── Propuestas de la IA (el equipo acepta o rechaza) ────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_propuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES public.whatsapp_conversaciones(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  -- vincular_lead · cambiar_etapa · actualizar_campo · producto · tarea · nuevo_encargo
  tipo TEXT NOT NULL,
  clave TEXT NOT NULL,                    -- evita repetir la misma propuesta
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada')),
  resuelta_por TEXT,
  resuelta_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversacion_id, clave)
);
CREATE INDEX IF NOT EXISTS whatsapp_propuestas_estado_idx ON public.whatsapp_propuestas(estado, created_at DESC);

-- ── Registro de eventos del webhook (salud / depuración) ────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_eventos (
  id BIGSERIAL PRIMARY KEY,
  recibido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  campo TEXT NOT NULL DEFAULT '',         -- messages · smb_message_echoes · history · …
  mensajes INTEGER NOT NULL DEFAULT 0,    -- mensajes nuevos guardados
  error TEXT,
  payload JSONB
);

-- ── updated_at ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS whatsapp_conversaciones_updated_at ON public.whatsapp_conversaciones;
CREATE TRIGGER whatsapp_conversaciones_updated_at BEFORE UPDATE ON public.whatsapp_conversaciones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS whatsapp_config_updated_at ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: el equipo lee y escribe; el tapicero no ve nada ────────────────────
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_propuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_config_equipo_read ON public.whatsapp_config;
CREATE POLICY whatsapp_config_equipo_read ON public.whatsapp_config
  FOR SELECT TO authenticated USING (public.es_equipo());

DROP POLICY IF EXISTS whatsapp_conversaciones_equipo ON public.whatsapp_conversaciones;
CREATE POLICY whatsapp_conversaciones_equipo ON public.whatsapp_conversaciones
  FOR ALL TO authenticated USING (public.es_equipo()) WITH CHECK (public.es_equipo());

DROP POLICY IF EXISTS whatsapp_mensajes_equipo ON public.whatsapp_mensajes;
CREATE POLICY whatsapp_mensajes_equipo ON public.whatsapp_mensajes
  FOR SELECT TO authenticated USING (public.es_equipo());

DROP POLICY IF EXISTS whatsapp_propuestas_equipo ON public.whatsapp_propuestas;
CREATE POLICY whatsapp_propuestas_equipo ON public.whatsapp_propuestas
  FOR ALL TO authenticated USING (public.es_equipo()) WITH CHECK (public.es_equipo());

DROP POLICY IF EXISTS whatsapp_eventos_equipo_read ON public.whatsapp_eventos;
CREATE POLICY whatsapp_eventos_equipo_read ON public.whatsapp_eventos
  FOR SELECT TO authenticated USING (public.es_equipo());

GRANT SELECT ON public.whatsapp_config, public.whatsapp_mensajes, public.whatsapp_eventos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversaciones, public.whatsapp_propuestas TO authenticated;
GRANT ALL ON public.whatsapp_config, public.whatsapp_conversaciones, public.whatsapp_mensajes,
  public.whatsapp_propuestas, public.whatsapp_eventos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_eventos_id_seq TO service_role;

-- ── Realtime: la bandeja se actualiza sola ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversaciones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_mensajes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensajes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_propuestas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_propuestas;
  END IF;
END $$;

-- ── Fila de configuración con tokens aleatorios ─────────────────────────────
INSERT INTO public.whatsapp_config (id, webhook_token, verify_token)
VALUES (1, encode(gen_random_bytes(24), 'hex'), encode(gen_random_bytes(18), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- ── Cron: cada 2 minutos se analizan las conversaciones con mensajes nuevos ─
-- (pg_cron + pg_net ya están instalados en el proyecto). El token viaja en la
-- cabecera x-whatsapp-token; el servidor lo compara con whatsapp_config.
-- Se programa desde la sesión con el token real; ver notas de despliegue.
