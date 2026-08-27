ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS prioridad SMALLINT NOT NULL DEFAULT 2 CHECK (prioridad IN (1,2,3)),
  ADD COLUMN IF NOT EXISTS fecha_recogida DATE,
  ADD COLUMN IF NOT EXISTS nota_tapicero TEXT,
  ADD COLUMN IF NOT EXISTS orden_produccion INTEGER;

UPDATE public.pedidos SET prioridad = 1 WHERE prioritario = true AND prioridad = 2;

ALTER TABLE public.pedido_telas
  ADD COLUMN IF NOT EXISTS tela_coleccion TEXT;

ALTER TABLE public.pedido_archivos
  ADD COLUMN IF NOT EXISTS transportista TEXT;

ALTER TABLE public.pedido_archivos DROP CONSTRAINT IF EXISTS pedido_archivos_tipo_check;

ALTER TABLE public.pedido_archivos ADD CONSTRAINT pedido_archivos_tipo_check
  CHECK (tipo IN ('plantilla','etiqueta_ctt','etiqueta_envio','referencia','foto_terminado'));

ALTER TABLE public.tapiceros
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS access_token_activo BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS tapiceros_access_token_unq
  ON public.tapiceros(access_token) WHERE access_token IS NOT NULL;