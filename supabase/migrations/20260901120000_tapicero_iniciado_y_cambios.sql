-- Dos necesidades del taller:
--
-- 1) INICIAR PRODUCCIÓN (lo marca el propio tapicero).
--    Hasta ahora el tapicero solo podía marcar "tela recibida" y "terminado".
--    Falta un estado intermedio: "ya lo he empezado", para que el equipo vea que
--    el pedido está en marcha. Es un 3er botón en su panel.
--
-- 2) AVISO DE CAMBIOS TRAS ENVÍO.
--    Si el equipo cambia algo de un pedido/producto que YA está en manos de un
--    tapicero (asignado y visible en su panel), el tapicero debe enterarse por si
--    ya había empezado a fabricarlo. Guardamos una marca + fecha + un detalle
--    legible; el tapicero la puede dar por vista desde su panel.
--
-- Migración ADITIVA: solo añade columnas con default. No toca datos existentes.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS iniciado_tapicero        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iniciado_tapicero_por    TEXT,
  ADD COLUMN IF NOT EXISTS iniciado_tapicero_fecha  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cambio_tras_envio        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cambio_tras_envio_fecha  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cambio_tras_envio_detalle TEXT;
