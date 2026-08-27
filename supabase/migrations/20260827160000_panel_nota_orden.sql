-- ══════════════════════════════════════════════════════════════════════════
-- Panel del tapicero: comentario propio para el tapicero + orden de producción.
--
-- Aditiva. No toca datos existentes.
--   · nota_tapicero: comentario que SÍ ve el tapicero (p. ej. dirección de la
--     tela). Las notas internas del pedido/producto NO se le muestran.
--   · orden_produccion: orden manual de trabajo (1º, 2º, 3º…). NULL = sin orden.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS nota_tapicero TEXT,
  ADD COLUMN IF NOT EXISTS orden_produccion INTEGER;
