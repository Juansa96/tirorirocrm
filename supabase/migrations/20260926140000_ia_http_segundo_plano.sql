-- Llamadas largas a la IA en segundo plano con pg_net (croquis con Claude).
-- El servidor de la app (Cloudflare) no aguanta una petición abierta varios
-- minutos, y la API de lotes de Anthropic puede quedarse en cola mucho rato.
-- pg_net hace la petición desde la base de datos sin límite de tiempo de la
-- app; la ruta /api/pedidos/croquis la lanza y luego el navegador pregunta
-- cada pocos segundos hasta que hay respuesta en net._http_response.
-- Solo service_role (el servidor) puede usarlas. Aplicado en producción el 26/09/2026.

create or replace function public.ia_http_lanzar(p_url text, p_headers jsonb, p_body jsonb, p_timeout_ms integer)
returns bigint
language sql
security definer
set search_path = public, net
as $$
  select net.http_post(url := p_url, body := p_body, params := '{}'::jsonb, headers := p_headers, timeout_milliseconds := p_timeout_ms);
$$;

create or replace function public.ia_http_resultado(p_id bigint)
returns table(status_code integer, content text, timed_out boolean, error_msg text)
language sql
security definer
set search_path = public, net
as $$
  select r.status_code, r.content, r.timed_out, r.error_msg from net._http_response r where r.id = p_id;
$$;

revoke all on function public.ia_http_lanzar(text, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.ia_http_resultado(bigint) from public, anon, authenticated;
grant execute on function public.ia_http_lanzar(text, jsonb, jsonb, integer) to service_role;
grant execute on function public.ia_http_resultado(bigint) to service_role;
