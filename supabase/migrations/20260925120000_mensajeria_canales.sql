-- ══════════════════════════════════════════════════════════════════════════
-- Bandeja de mensajes: Instagram (mensajes directos) y email (info@) además
-- de WhatsApp.
--
-- Los mensajes y conversaciones de los tres canales van en las tablas
-- whatsapp_* que ya existen (sin columnas nuevas): el canal va en la clave de
-- la conversación ("ig:<id>", "mail:<correo>"; ver src/lib/whatsapp/canales.ts).
-- Aquí solo se guarda la configuración y el estado de Instagram y email, que
-- incluye la clave de acceso de Instagram: SOLO la leen los admin.
--
-- Aplicada en producción desde la sesión de Claude el 25/09/2026 (Lovable no
-- ejecuta estas migraciones solas).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mensajeria_canales (
  canal TEXT PRIMARY KEY CHECK (canal IN ('instagram', 'email')),
  activo BOOLEAN NOT NULL DEFAULT true,
  -- instagram: access_token, app_secret, cuenta_id, usuario, token_renovado_at
  -- email: cuenta
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  conectado_at TIMESTAMPTZ,              -- desde aquí los mensajes son "en vivo" (antes, historial)
  ultimo_evento_at TIMESTAMPTZ,
  ultimo_error TEXT,
  ultimo_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS mensajeria_canales_updated_at ON public.mensajeria_canales;
CREATE TRIGGER mensajeria_canales_updated_at BEFORE UPDATE ON public.mensajeria_canales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mensajeria_canales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mensajeria_canales_admin_read ON public.mensajeria_canales;
CREATE POLICY mensajeria_canales_admin_read ON public.mensajeria_canales
  FOR SELECT TO authenticated USING (public.es_admin());

GRANT SELECT ON public.mensajeria_canales TO authenticated;
GRANT ALL ON public.mensajeria_canales TO service_role;

INSERT INTO public.mensajeria_canales (canal, datos) VALUES
  ('instagram', '{}'::jsonb),
  ('email', '{"cuenta": "info@tirorirohome.com"}'::jsonb)
ON CONFLICT (canal) DO NOTHING;
