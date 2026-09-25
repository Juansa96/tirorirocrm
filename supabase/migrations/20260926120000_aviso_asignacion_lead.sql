-- Correo "Se te ha asignado un contacto" (petición de Juan, 26/09/2026).
-- Cuando un lead se crea o se reasigna a un vendedor con aviso, la BD llama a
-- /api/leads/aviso-asignacion (pg_net), que manda el correo. Sin columnas
-- nuevas. El token es el de whatsapp_config (mismo que usa el cron de WhatsApp).
-- APLICADA en producción desde la sesión de Claude el 26/09/2026.

CREATE OR REPLACE FUNCTION public.leads_aviso_asignacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF NEW.vendedor IS NULL OR lower(NEW.vendedor) NOT IN ('sangradortorresjuan@gmail.com') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND lower(coalesce(OLD.vendedor, '')) = lower(NEW.vendedor) THEN
    RETURN NEW;
  END IF;
  SELECT webhook_token INTO tok FROM public.whatsapp_config WHERE id = 1;
  IF tok IS NULL OR tok = '' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://tirorirocrm.lovable.app/api/leads/aviso-asignacion',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whatsapp-token', tok),
    body := jsonb_build_object('leadId', NEW.id),
    timeout_milliseconds := 30000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca impedir guardar un lead por culpa del aviso.
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leads_aviso_asignacion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS leads_aviso_asignacion ON public.leads;
CREATE TRIGGER leads_aviso_asignacion
  AFTER INSERT OR UPDATE OF vendedor ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_aviso_asignacion();
