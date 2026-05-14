
REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
