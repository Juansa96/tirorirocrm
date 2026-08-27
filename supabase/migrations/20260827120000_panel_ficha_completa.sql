-- ══════════════════════════════════════════════════════════════════════════
-- Panel del tapicero — ficha de detalle completa.
--
-- Aditiva. No toca datos ni el catálogo de productos existente.
--   · Prioridad graduada por producto (alta/normal/baja) — el equipo la asigna,
--     el tapicero solo la ve; ordena su panel.
--   · Fecha prevista de recogida por Juan en el taller.
--   · Imagen de referencia del acabado y etiqueta de envío (nuevo transportista)
--     como archivos del pedido.
--   · Colección/proveedor de cada tela, denormalizado en pedido_telas para que
--     el tapicero lo vea sin acceso a la biblioteca de telas.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Prioridad graduada + fecha de recogida ──────────────────────────────────
-- prioridad: 1 = Alta, 2 = Normal, 3 = Baja. Default Normal.
-- Cada pedido corresponde a un único producto (producto_lead_id), así que la
-- prioridad de pedido es, de hecho, la del producto.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS prioridad SMALLINT NOT NULL DEFAULT 2
    CHECK (prioridad IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS fecha_recogida DATE;

-- Continuidad con el destacado (estrella) anterior: los que ya estaban marcados
-- como prioritario pasan a prioridad Alta. `prioritario` se conserva por
-- compatibilidad, pero la app usa `prioridad`.
UPDATE public.pedidos SET prioridad = 1 WHERE prioritario = true AND prioridad = 2;

-- ── Colección / proveedor de la tela (denormalizado para el tapicero) ───────
ALTER TABLE public.pedido_telas
  ADD COLUMN IF NOT EXISTS tela_coleccion TEXT;

-- ── Archivos del pedido: imagen de referencia + etiqueta de envío ───────────
-- Se amplía el CHECK de `tipo` para admitir:
--   · 'referencia'     → imagen del acabado (la generada con Gemini), la sube el
--                        equipo; el tapicero la ve en grande.
--   · 'etiqueta_envio' → etiqueta de transporte (antes solo 'etiqueta_ctt').
-- Se conserva 'etiqueta_ctt' para no romper filas históricas: la UI trata ambos
-- como "etiqueta de envío".
ALTER TABLE public.pedido_archivos
  DROP CONSTRAINT IF EXISTS pedido_archivos_tipo_check;
ALTER TABLE public.pedido_archivos
  ADD CONSTRAINT pedido_archivos_tipo_check
    CHECK (tipo IN ('plantilla', 'etiqueta_ctt', 'etiqueta_envio', 'referencia'));

-- Transportista de la etiqueta de envío (ctt | mrw | otro texto). NULL para el
-- resto de archivos.
ALTER TABLE public.pedido_archivos
  ADD COLUMN IF NOT EXISTS transportista TEXT;

-- Las políticas RLS existentes ya cubren estas columnas y tipos nuevos:
--   · pedidos / pedido_telas / pedido_archivos → equipo escribe todo; el
--     tapicero SOLO LECTURA de lo suyo (ver 20260729160000_roles_perfiles_rls y
--     20260729180000_fase2_telas_archivos). No hace falta tocar RLS aquí.
