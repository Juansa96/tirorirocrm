-- Contador y fechas de cada conversación de la bandeja, en la propia BD.
-- Antes los actualizaba el webhook DESPUÉS de guardar los mensajes: si fallaba
-- entre medias (y el webhook responde 200 para que Meta no reintente en bucle),
-- los mensajes quedaban guardados pero el chat con 0 mensajes y sin fecha, y ni
-- la bandeja ni la IA lo veían. Ahora se actualiza en la misma transacción que
-- el alta de los mensajes. Se recuenta (no se suma) y las fechas solo avanzan.
-- Aplicado en producción el 26/09/2026.

create or replace function public.whatsapp_mensajes_contador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_conversaciones c
     set mensajes = (select count(*) from public.whatsapp_mensajes m where m.conversacion_id = c.id),
         ultimo_mensaje_at = greatest(c.ultimo_mensaje_at, n.ult),
         ultimo_mensaje_entrante_at = greatest(c.ultimo_mensaje_entrante_at, n.ult_ent)
    from (
      select conversacion_id, max(enviado_at) as ult,
             max(enviado_at) filter (where direccion = 'entrante') as ult_ent
        from nuevos
       group by conversacion_id
    ) n
   where c.id = n.conversacion_id;
  return null;
end;
$$;

drop trigger if exists whatsapp_mensajes_contador on public.whatsapp_mensajes;
create trigger whatsapp_mensajes_contador
  after insert on public.whatsapp_mensajes
  referencing new table as nuevos
  for each statement execute function public.whatsapp_mensajes_contador();

-- Arreglo de lo que ya estuviera descuadrado.
update public.whatsapp_conversaciones c
   set mensajes = r.n,
       ultimo_mensaje_at = greatest(c.ultimo_mensaje_at, r.ult),
       ultimo_mensaje_entrante_at = greatest(c.ultimo_mensaje_entrante_at, r.ult_ent)
  from (
    select conversacion_id, count(*) as n, max(enviado_at) as ult,
           max(enviado_at) filter (where direccion = 'entrante') as ult_ent
      from public.whatsapp_mensajes group by conversacion_id
  ) r
 where c.id = r.conversacion_id
   and (c.mensajes <> r.n or c.ultimo_mensaje_at is distinct from greatest(c.ultimo_mensaje_at, r.ult)
        or c.ultimo_mensaje_entrante_at is distinct from greatest(c.ultimo_mensaje_entrante_at, r.ult_ent));
