-- Aviso de seguridad de Lovable «Some database functions could run someone else's
-- code» (27/09/2026): funciones sin search_path fijo. Se fija a public, pg_temp; no
-- cambia lo que hacen (todo lo que usan está en public o va cualificado: net., cron.).
-- Ya aplicado en producción desde la sesión.
--
-- _ig_hist_paso y _ig_hist_siguiente se crearon a mano en producción (importación
-- del historial de Instagram) y no tienen migración: cada ALTER solo se hace si la
-- función existe, para que aplicar las migraciones desde cero no se pare aquí.
do $$
declare f text;
begin
  foreach f in array array[
    'public._ig_hist_paso()',
    'public._ig_hist_siguiente(bigint)',
    'public.mask_apellido(text)',
    'public.pedidos_set_numero()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public, pg_temp', f);
    end if;
  end loop;
end $$;
