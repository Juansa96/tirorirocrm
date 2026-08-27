-- 1) Funciones SECURITY DEFINER: fuera de PUBLIC/anon.
--    Solo los usuarios autenticados (y service_role) pueden ejecutarlas; son
--    necesarias para las políticas RLS y devuelven únicamente el rol propio.
REVOKE EXECUTE ON FUNCTION public.es_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_equipo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mi_rol() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mi_tapicero_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.es_equipo() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mi_rol() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mi_tapicero_id() TO authenticated, service_role;

-- 2) Lectura de los buckets privados: equipo y tapiceros autenticados.
DROP POLICY IF EXISTS telas_read_interno ON storage.objects;
CREATE POLICY telas_read_interno ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'telas' AND (public.es_equipo() OR public.mi_tapicero_id() IS NOT NULL));

DROP POLICY IF EXISTS pedido_archivos_read_interno ON storage.objects;
CREATE POLICY pedido_archivos_read_interno ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pedido-archivos' AND (public.es_equipo() OR public.mi_tapicero_id() IS NOT NULL));
