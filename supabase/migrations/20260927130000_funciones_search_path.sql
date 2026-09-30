-- Aviso de seguridad de Lovable «Some database functions could run someone else's
-- code» (27/09/2026): funciones sin search_path fijo. Se fija a public, pg_temp; no
-- cambia lo que hacen (todo lo que usan está en public o va cualificado: net., cron.).
-- Ya aplicado en producción desde la sesión.
--
-- Las dos funciones auxiliares de la importación del historial de Instagram se
-- crearon a mano en producción (ya tienen el search_path fijado) y no tienen
-- migración, así que no se nombran aquí: si se nombran, aplicar las migraciones
-- desde cero falla y Lovable avisa de «functions that don't exist».
do $$
declare f text;
begin
  foreach f in array array[
    'public.mask_apellido(text)',
    'public.pedidos_set_numero()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public, pg_temp', f);
    end if;
  end loop;
end $$;
