ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_unico
  ON public.pedidos (numero) WHERE numero IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq;

WITH activos AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.pedidos
  WHERE numero IS NULL
    AND COALESCE(entregado, false) = false
    AND COALESCE(terminado_tapicero, false) = false
    AND COALESCE(estado_pedido, 'En proceso') <> 'Entregado'
)
UPDATE public.pedidos p
SET numero = a.rn
FROM activos a
WHERE p.id = a.id;

SELECT setval('public.pedidos_numero_seq', GREATEST(COALESCE((SELECT max(numero) FROM public.pedidos), 0), 1),
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

ALTER TABLE public.tapiceros
  ADD COLUMN IF NOT EXISTS oculta_apellidos BOOLEAN NOT NULL DEFAULT false;

UPDATE public.tapiceros
SET oculta_apellidos = true
WHERE lower(btrim(nombre)) = 'daniel'
  AND lower(btrim(apellido)) LIKE 'vytas%';

CREATE OR REPLACE FUNCTION public.mask_apellido(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN full_name IS NULL OR btrim(full_name) = '' THEN full_name
    WHEN position(' ' IN btrim(full_name)) = 0 THEN btrim(full_name)
    ELSE split_part(btrim(full_name), ' ', 1) || ' ' ||
         upper(left(split_part(btrim(full_name), ' ', 2), 1)) || '.'
  END;
$$;

CREATE OR REPLACE FUNCTION public.panel_pedidos(p_tapicero_id uuid)
RETURNS SETOF public.pedidos
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ocultar boolean := false;
  r public.pedidos%rowtype;
BEGIN
  IF NOT (public.es_equipo() OR p_tapicero_id = public.mi_tapicero_id()) THEN
    RETURN;
  END IF;

  IF p_tapicero_id = public.mi_tapicero_id() THEN
    SELECT COALESCE(t.oculta_apellidos, false) INTO v_ocultar
    FROM public.tapiceros t WHERE t.id = p_tapicero_id;
  END IF;

  FOR r IN
    SELECT * FROM public.pedidos WHERE tapicero_id = p_tapicero_id
  LOOP
    IF v_ocultar THEN
      r.cliente_nombre := public.mask_apellido(r.cliente_nombre);
      r.cliente_nombre_libre := public.mask_apellido(r.cliente_nombre_libre);
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mask_apellido(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.panel_pedidos(uuid) TO authenticated;