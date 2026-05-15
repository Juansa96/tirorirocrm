
CREATE TABLE IF NOT EXISTS public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notas" ON public.notas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notas" ON public.notas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update notas" ON public.notas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete notas" ON public.notas FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.productos_lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT,
  modelo TEXT,
  ancho NUMERIC,
  alto NUMERIC,
  tela TEXT,
  color TEXT,
  relleno TEXT,
  patas TEXT,
  acabado TEXT,
  coleccion_tela TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  notas_producto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);
ALTER TABLE public.productos_lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read prod" ON public.productos_lead FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert prod" ON public.productos_lead FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update prod" ON public.productos_lead FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete prod" ON public.productos_lead FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productos_lead;
