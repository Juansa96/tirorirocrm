-- Aviso de seguridad de Lovable «Some database functions could run someone else's
-- code» (27/09/2026): funciones sin search_path fijo. Se fija a public, pg_temp; no
-- cambia lo que hacen (todo lo que usan está en public o va cualificado: net., cron.).
-- Ya aplicado en producción desde la sesión.
alter function public._ig_hist_paso() set search_path = public, pg_temp;
alter function public._ig_hist_siguiente(bigint) set search_path = public, pg_temp;
alter function public.mask_apellido(text) set search_path = public, pg_temp;
alter function public.pedidos_set_numero() set search_path = public, pg_temp;
