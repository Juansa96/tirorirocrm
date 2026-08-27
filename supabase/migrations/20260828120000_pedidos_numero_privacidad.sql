-- ══════════════════════════════════════════════════════════════════════════
-- Numeración de pedidos + privacidad de apellidos para el tapicero.
--
-- 1) pedidos.numero  — número único y correlativo, PERMANENTE.
--      · Backfill: 1..N SOLO a los pedidos activos/en producción (no
--        entregados ni terminados), por fecha de creación ascendente.
--      · Secuencia global: los nuevos continúan desde el último número.
--      · Nunca se reutiliza ni se renumera (índice único parcial).
--      · Un admin puede editarlo a mano (validación de duplicado en la app +
--        índice único como red de seguridad en BD).
--
-- 2) tapiceros.oculta_apellidos — cuando true, ese tapicero ve el apellido del
--    cliente reducido a la inicial ("Borja G."). Backfill: Daniel Vytas = true.
--
-- 3) mask_apellido() + panel_pedidos() — el enmascarado se hace EN LA CONSULTA
--    (SECURITY DEFINER), no solo en la UI: el panel del tapicero lee los
--    pedidos a través de panel_pedidos(), que devuelve el nombre ya recortado
--    cuando quien mira es el propio tapicero con el flag activo. El equipo
--    (es_equipo) siempre ve el nombre completo.
--
-- No destructiva. No renumera ni modifica registros históricos salvo el
-- backfill inicial del número.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1) Número de pedido ──────────────────────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero INTEGER;

-- Único entre los que tienen número (los sin número quedan NULL y no chocan).
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_unico
  ON public.pedidos (numero) WHERE numero IS NOT NULL;

-- Secuencia global de numeración. Arranca en 1; el backfill la reposiciona.
CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq;

-- Backfill: solo pedidos activos/en producción, por antigüedad. Se ejecuta una
-- sola vez (WHERE numero IS NULL) — si ya hay números asignados, no toca nada.
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

-- Reposiciona la secuencia al máximo asignado (los nuevos siguen desde ahí).
SELECT setval('public.pedidos_numero_seq', GREATEST(COALESCE((SELECT max(numero) FROM public.pedidos), 0), 1),
              COALESCE((SELECT max(numero) FROM public.pedidos), 0) > 0);

-- Asigna número a CADA pedido nuevo que no traiga uno. Nunca renumera (solo
-- rellena NULL). El número que se asigna a mano (admin) se respeta tal cual.
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

-- ── 2) Flag de privacidad por tapicero ───────────────────────────────────────
ALTER TABLE public.tapiceros
  ADD COLUMN IF NOT EXISTS oculta_apellidos BOOLEAN NOT NULL DEFAULT false;

-- Backfill: Daniel Vytas oculta apellidos.
UPDATE public.tapiceros
SET oculta_apellidos = true
WHERE lower(btrim(nombre)) = 'daniel'
  AND lower(btrim(apellido)) LIKE 'vytas%';

-- ── 3) Enmascarado en la consulta ────────────────────────────────────────────
-- "Borja Gil Delgado" → "Borja G.". Nombre + inicial del primer apellido.
CREATE OR REPLACE FUNCTION public.mask_apellido(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN full_name IS NULL OR btrim(full_name) = '' THEN full_name
    WHEN position(' ' IN btrim(full_name)) = 0 THEN btrim(full_name)
    ELSE split_part(btrim(full_name), ' ', 1) || ' ' ||
         upper(left(split_part(btrim(full_name), ' ', 2), 1)) || '.'
  END;
$$;

-- Pedidos del panel de un tapicero, con el nombre del cliente enmascarado
-- cuando quien mira es ese mismo tapicero y tiene el flag. El equipo ve todo.
-- Devuelve las mismas columnas de `pedidos` que consume panel-data.ts.
CREATE OR REPLACE FUNCTION public.panel_pedidos(p_tapicero_id uuid)
RETURNS SETOF public.pedidos
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ocultar boolean := false;
  r public.pedidos%rowtype;
BEGIN
  -- Autorización: equipo (cualquier tapicero) o el propio tapicero (el suyo).
  IF NOT (public.es_equipo() OR p_tapicero_id = public.mi_tapicero_id()) THEN
    RETURN;
  END IF;

  -- Solo se oculta cuando QUIEN MIRA es el propio tapicero con el flag.
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
