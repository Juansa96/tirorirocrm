-- Revoke EXECUTE from anon and authenticated on all internal SECURITY DEFINER functions in public schema.
-- These are trigger-only or server-side-only helpers; the frontend never calls them directly.
REVOKE EXECUTE ON FUNCTION public.tg_leads_etapa_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_producto_confirmacion() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_pedidos_fecha_limite() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_productos_lead_recalc() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_lead_valor(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_leads_sync_valor() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
