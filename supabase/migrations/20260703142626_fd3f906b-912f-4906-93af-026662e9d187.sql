ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'B2C',
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS contacto_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_apellidos TEXT,
  ADD COLUMN IF NOT EXISTS contacto_cargo TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS web TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS notas_b2b TEXT,
  ADD COLUMN IF NOT EXISTS asignados TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_tipo_check') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_tipo_check CHECK (tipo IN ('B2C','B2B'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leads_b2b_nif_uniq
  ON public.leads (LOWER(nif)) WHERE tipo='B2B' AND nif IS NOT NULL AND nif <> '';

CREATE UNIQUE INDEX IF NOT EXISTS leads_b2b_razon_social_uniq
  ON public.leads (LOWER(razon_social))
  WHERE tipo='B2B' AND (nif IS NULL OR nif='') AND razon_social IS NOT NULL AND razon_social <> '';

CREATE INDEX IF NOT EXISTS leads_tipo_idx ON public.leads(tipo);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pedidos_empresa_id_idx ON public.pedidos(empresa_id);