-- ════════════════════════════════════════════════════════════════════════════
-- Blindaje de seguridad de funciones (avisos del linter de Supabase):
--   · 0011_function_search_path_mutable  → fijar search_path en TODAS nuestras
--     funciones del esquema public (evita el "search_path mutable").
--   · 0028_anon_security_definer_function_executable → quitar EXECUTE a `anon`
--     y a `public` en las funciones SECURITY DEFINER (no deben poder llamarse
--     sin iniciar sesión). Después se re-concede EXECUTE SOLO a los roles que la
--     app necesita.
--
-- NO se tocan los cuerpos de las funciones ni las políticas RLS: solo metadatos
-- (search_path) y permisos de ejecución. Es idempotente (se puede re-aplicar).
-- Las funciones de extensiones (pgmq, pg_net, etc.) se excluyen a propósito.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      -- Excluir funciones que pertenecen a una extensión (no son nuestras).
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    BEGIN
      -- 0011: fijar search_path (no rompe el cuerpo; usa el esquema public).
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
      -- 0028: las SECURITY DEFINER no deben ser ejecutables por anon / público.
      IF r.prosecdef THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', r.proname, r.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Si alguna función puntual no se puede alterar (permisos), se omite sin
      -- abortar la migración entera.
      RAISE NOTICE 'Se omite public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── Re-conceder EXECUTE a quien SÍ debe poder llamar cada función ────────────
-- Cada GRANT va en su propio bloque tolerante: si una firma cambiara en el
-- futuro, no tumba la migración.
DO $$
DECLARE
  sig text;
  authed text[] := ARRAY[
    'public.panel_cliente_nombres(uuid[])',
    'public.panel_pedidos(uuid)',
    'public.mask_apellido(text)',
    'public.mi_rol()',
    'public.es_equipo()',
    'public.es_admin()',
    'public.mi_tapicero_id()'
  ];
  svc text[] := ARRAY[
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.delete_email(text, bigint)',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.recalc_lead_valor(uuid)'
  ];
BEGIN
  FOREACH sig IN ARRAY authed LOOP
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || sig || ' TO authenticated';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo conceder authenticated en %: %', sig, SQLERRM;
    END;
  END LOOP;
  FOREACH sig IN ARRAY svc LOOP
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || sig || ' TO service_role';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo conceder service_role en %: %', sig, SQLERRM;
    END;
  END LOOP;
END $$;
