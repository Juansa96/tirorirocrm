-- Panel del tapicero: mantener SIEMPRE poblado `cliente_nombre` (el nombre de
-- cliente denormalizado que ve el tapicero, ya que no tiene acceso a `leads`).
--
-- Hasta ahora solo se rellenaba en un backfill puntual y al crear pedidos
-- manuales. Los pedidos creados por otras vías (o cuyo lead se renombró después)
-- podían quedar con `cliente_nombre` vacío y aparecer como "Sin cliente" en el
-- panel. Esta migración lo rellena, lo mantiene con triggers y añade un respaldo
-- en la RPC del panel. Aditiva e idempotente.

-- 1) Backfill: rellena cliente_nombre desde el nombre libre o desde el lead.
UPDATE public.pedidos
SET cliente_nombre = cliente_nombre_libre
WHERE coalesce(cliente_nombre_libre, '') <> ''
  AND coalesce(cliente_nombre, '') = '';

UPDATE public.pedidos p
SET cliente_nombre = l.nombre
FROM public.leads l
WHERE l.id = p.lead_id
  AND coalesce(p.cliente_nombre, '') = ''
  AND coalesce(p.cliente_nombre_libre, '') = ''
  AND coalesce(l.nombre, '') <> '';

-- 2) Trigger en pedidos: al insertar/actualizar, si cliente_nombre queda vacío,
--    se rellena desde el nombre libre o desde el lead vinculado. SECURITY
--    DEFINER para poder leer `leads` sea quien sea que actualice el pedido.
CREATE OR REPLACE FUNCTION public.tg_pedidos_cliente_nombre()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.cliente_nombre, '') = '' THEN
    IF coalesce(NEW.cliente_nombre_libre, '') <> '' THEN
      NEW.cliente_nombre := NEW.cliente_nombre_libre;
    ELSIF NEW.lead_id IS NOT NULL THEN
      SELECT l.nombre INTO NEW.cliente_nombre FROM public.leads l WHERE l.id = NEW.lead_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_cliente_nombre ON public.pedidos;
-- Se ejecuta ANTES que el trigger de fecha límite/estado por orden alfabético;
-- ambos son BEFORE y solo tocan NEW, así que el orden no genera conflicto.
CREATE TRIGGER pedidos_cliente_nombre
  BEFORE INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pedidos_cliente_nombre();

-- 3) Trigger en leads: al renombrar un lead, propaga el nombre a sus pedidos
--    que no tengan nombre libre (para que el panel no quede desactualizado).
CREATE OR REPLACE FUNCTION public.tg_leads_sync_cliente_nombre()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.nombre, '') <> coalesce(OLD.nombre, '') THEN
    UPDATE public.pedidos
    SET cliente_nombre = NEW.nombre
    WHERE lead_id = NEW.id
      AND coalesce(cliente_nombre_libre, '') = '';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_cliente_nombre ON public.leads;
CREATE TRIGGER leads_sync_cliente_nombre
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_leads_sync_cliente_nombre();

-- 4) RPC del panel: red de seguridad. Si cliente_nombre y el nombre libre están
--    vacíos, cae al nombre del lead vinculado (respetando el enmascarado del
--    apellido cuando quien llama es un tapicero).
CREATE OR REPLACE FUNCTION public.panel_cliente_nombres(p_ids uuid[])
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    CASE
      WHEN public.mi_tapicero_id() IS NOT NULL
        THEN public.mask_apellido(COALESCE(NULLIF(p.cliente_nombre, ''), NULLIF(p.cliente_nombre_libre, ''), l.nombre))
      ELSE COALESCE(NULLIF(p.cliente_nombre, ''), NULLIF(p.cliente_nombre_libre, ''), l.nombre)
    END AS nombre
  FROM public.pedidos p
  LEFT JOIN public.leads l ON l.id = p.lead_id
  WHERE p.id = ANY(p_ids)
    AND (public.es_equipo() OR p.tapicero_id = public.mi_tapicero_id());
$$;

GRANT EXECUTE ON FUNCTION public.panel_cliente_nombres(uuid[]) TO authenticated;
