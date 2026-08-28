ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero_sufijo TEXT;
DROP INDEX IF EXISTS public.pedidos_numero_unico;
CREATE INDEX IF NOT EXISTS pedidos_numero_idx ON public.pedidos (numero) WHERE numero IS NOT NULL;