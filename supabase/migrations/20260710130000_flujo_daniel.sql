-- Tarea 8: flujo de producción "Daniel" + flujo corto de pantallas.
-- Añade los hitos nuevos a pedidos. No borra datos existentes; los hitos
-- antiguos (estructura_hecha, tapizado_hecho) se conservan por compatibilidad.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS solicitado_daniel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS solicitado_daniel_fecha DATE,
  ADD COLUMN IF NOT EXISTS enviar_tela_daniel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enviar_tela_daniel_fecha DATE,
  ADD COLUMN IF NOT EXISTS recibir_daniel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recibir_daniel_fecha DATE,
  ADD COLUMN IF NOT EXISTS terminado_daniel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terminado_daniel_fecha DATE,
  ADD COLUMN IF NOT EXISTS enviado_daniel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enviado_daniel_fecha DATE,
  ADD COLUMN IF NOT EXISTS pantalla_hecha BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pantalla_hecha_fecha DATE;
