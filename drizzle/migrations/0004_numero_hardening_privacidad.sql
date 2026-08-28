ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_unico
  ON public.pedidos (numero) WHERE numero IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq;

WITH sin_numero AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.pedidos
  WHERE numero IS NULL
    AND COALESCE(entregado, false) = false
    AND COALESCE(terminado_tapicero, false) = false
    AND COALESCE(estado_pedido, 'En proceso') <> 'Entregado'
)
UPDATE public.pedidos p
SET numero = s.rn + COALESCE((SELECT max(numero) FROM public.pedidos), 0)
FROM sin_numero s
WHERE p.id = s.id;

SELECT setval('public.pedidos_numero_seq',
              GREATEST(COALESCE((SELECT max(numero) FROM public.pedidos), 0), 1),
              COALESCE((SELECT max(numero) FROM public.pedidos), 0) > 0);

CREATE OR REPLACE FUNCTION public.pedidos_set_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := nextval('public.pedidos_numero_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_set_numero ON public.pedidos;
CREATE TRIGGER trg_pedidos_set_numero
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_set_numero();

CREATE OR REPLACE FUNCTION public.mask_apellido(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN full_name IS NULL OR btrim(full_name) = '' THEN full_name
    WHEN position(' ' IN btrim(full_name)) = 0 THEN btrim(full_name)
    ELSE split_part(btrim(full_name), ' ', 1) || ' ' ||
         upper(left(split_part(btrim(full_name), ' ', 2), 1)) || '.'
  END;
$$;

CREATE OR REPLACE FUNCTION public.panel_cliente_nombres(p_ids uuid[])
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    CASE
      WHEN public.mi_tapicero_id() IS NOT NULL
        THEN public.mask_apellido(COALESCE(NULLIF(p.cliente_nombre, ''), p.cliente_nombre_libre))
      ELSE COALESCE(NULLIF(p.cliente_nombre, ''), p.cliente_nombre_libre)
    END AS nombre
  FROM public.pedidos p
  WHERE p.id = ANY(p_ids)
    AND (public.es_equipo() OR p.tapicero_id = public.mi_tapicero_id());
$$;

GRANT EXECUTE ON FUNCTION public.mask_apellido(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.panel_cliente_nombres(uuid[]) TO authenticated;