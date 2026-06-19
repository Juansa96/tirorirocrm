-- Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated.
-- Triggers (set_updated_at, log_lead_changes, tg_leads_sync_valor, tg_productos_lead_recalc)
-- and worker-only helpers (pgmq wrappers, recalc_lead_valor) must not be RPC-callable by users.

REVOKE EXECUTE ON FUNCTION public.set_updated_at()                                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_lead_changes()                                  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_leads_sync_valor()                               FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_productos_lead_recalc()                          FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_lead_valor(uuid)                             FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                          FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)            FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                          FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)              FROM anon, authenticated, PUBLIC;

-- Keep service_role access (workers, cron, edge functions)
GRANT EXECUTE ON FUNCTION public.recalc_lead_valor(uuid)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                           TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)             TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)                           TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)               TO service_role;