-- Email del parte diario de marketing (Juan, 02/10/2026): lo manda el CRM para
-- que lleve las fotos de los anuncios (la herramienta de Gmail las borraba).
-- La rutina inserta en whatsapp_eventos una fila campo = 'parte_email' con el
-- email en payload; este trigger llama a /api/parte/enviar (pg_net). Sin
-- columnas ni tablas nuevas. Mismo token que el aviso de asignación.
-- APLICADA en producción desde la sesión de Claude el 02/10/2026.

CREATE OR REPLACE FUNCTION public.whatsapp_eventos_parte_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  SELECT webhook_token INTO tok FROM public.whatsapp_config WHERE id = 1;
  IF tok IS NULL OR tok = '' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://tirorirocrm.lovable.app/api/parte/enviar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whatsapp-token', tok),
    body := jsonb_build_object('id', NEW.id),
    timeout_milliseconds := 60000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_eventos_parte_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS whatsapp_eventos_parte_email ON public.whatsapp_eventos;
CREATE TRIGGER whatsapp_eventos_parte_email
  AFTER INSERT ON public.whatsapp_eventos
  FOR EACH ROW WHEN (NEW.campo = 'parte_email')
  EXECUTE FUNCTION public.whatsapp_eventos_parte_email();
