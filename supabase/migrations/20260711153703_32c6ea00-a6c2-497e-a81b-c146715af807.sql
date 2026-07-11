ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tipo_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_tipo_check CHECK (tipo IN ('B2C','B2B','INFLUENCER'));
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_etapa_check;