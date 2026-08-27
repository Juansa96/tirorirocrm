-- ══════════════════════════════════════════════════════════════════════════
-- Foto (opcional) del producto terminado, subida por el tapicero.
--
-- El tapicero sigue siendo SOLO LECTURA a nivel de BD: la subida NO se hace por
-- RLS de storage (que exige es_equipo), sino por la ruta de servidor
-- /api/tapicero/foto (service_role), que valida token, rol y propiedad del
-- pedido. Aquí solo se amplía el CHECK de tipos de archivo. No es requisito:
-- el tapicero puede terminar el pedido sin subir foto.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pedido_archivos
  DROP CONSTRAINT IF EXISTS pedido_archivos_tipo_check;
ALTER TABLE public.pedido_archivos
  ADD CONSTRAINT pedido_archivos_tipo_check
    CHECK (tipo IN ('plantilla', 'etiqueta_ctt', 'etiqueta_envio', 'referencia', 'foto_terminado'));

-- La política pedido_archivos_tapicero_read ya deja al tapicero LEER los
-- archivos de sus pedidos (incluida esta foto). La escritura la hace el servidor
-- con service_role, así que no se añade ninguna política de escritura para el
-- tapicero.
