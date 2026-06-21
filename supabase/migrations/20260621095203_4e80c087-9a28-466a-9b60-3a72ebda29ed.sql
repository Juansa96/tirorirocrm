
-- 1) Etiquetas libres en leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS etiquetas TEXT[] NOT NULL DEFAULT '{}';

-- 2) Tabla de fotos asociadas a un lead
CREATE TABLE IF NOT EXISTS public.lead_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  pie TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_fotos TO anon;
GRANT ALL ON public.lead_fotos TO service_role;

ALTER TABLE public.lead_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_fotos_all_anon" ON public.lead_fotos
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lead_fotos_all_auth" ON public.lead_fotos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_fotos_lead_id ON public.lead_fotos(lead_id);
