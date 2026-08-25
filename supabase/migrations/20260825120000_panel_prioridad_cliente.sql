-- Panel del tapicero: prioridad + nombre de cliente (denormalizado).
--
-- El tapicero NO tiene acceso a la tabla de clientes (leads) por seguridad, así
-- que guardamos el nombre del cliente en el propio pedido para que lo vea sin
-- exponer datos sensibles. `prioritario` lo marca el equipo y ordena su panel.
-- Aditiva.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS prioritario BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_nombre TEXT;

-- Backfill del nombre de cliente: nombre libre si lo hay, si no el del lead.
UPDATE public.pedidos p
SET cliente_nombre = l.nombre
FROM public.leads l
WHERE l.id = p.lead_id
  AND coalesce(p.cliente_nombre_libre, '') = ''
  AND coalesce(p.cliente_nombre, '') = '';

UPDATE public.pedidos
SET cliente_nombre = cliente_nombre_libre
WHERE coalesce(cliente_nombre_libre, '') <> ''
  AND coalesce(cliente_nombre, '') = '';
