-- Tarea 7: Influencers / colaboraciones (canje)
-- Añade los campos necesarios para fichas de influencer y pedidos de colaboración.
-- No borra ni modifica datos existentes.

-- Ficha de influencer (en leads). tipo puede valer ahora 'B2C' | 'B2B' | 'INFLUENCER'.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS seguidores INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_principal TEXT,
  ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Pedido de colaboración (canje). Se ve el precio pero NO cuenta como ingreso/venta.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS es_canje BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS formatos TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tipo_colaboracion TEXT;
