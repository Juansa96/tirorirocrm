-- Privacidad de apellidos (sin flag, siempre para tapiceros)
-- "Borja Gil Delgado" → "Borja G."
CREATE OR REPLACE FUNCTION public.mask_apellido(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN full_name IS NULL OR btrim(full_name) = '' THEN full_name
    WHEN position(' ' IN btrim(full_name)) = 0 THEN btrim(full_name)
    ELSE split_part(btrim(full_name), ' ', 1) || ' ' ||
         upper(left(split_part(btrim(full_name), ' ', 2), 1)) || '.'
  END;
$$;

-- Nombre del cliente para el panel. El apellido completo NUNCA se devuelve a un
-- tapicero: si quien llama es tapicero (mi_tapicero_id() no nulo), se recorta a
-- la inicial. El equipo recibe el nombre completo. Solo devuelve pedidos que el
-- que llama puede ver (equipo, o el tapicero dueño).
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