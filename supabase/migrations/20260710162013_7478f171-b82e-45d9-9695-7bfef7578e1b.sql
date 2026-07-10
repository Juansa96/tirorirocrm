
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS seguidores integer NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS red_principal text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS usuario text;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS es_canje boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS formatos text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_colaboracion text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS solicitado_daniel boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS solicitado_daniel_fecha date;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS enviar_tela_daniel boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS enviar_tela_daniel_fecha date;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS recibir_daniel boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS recibir_daniel_fecha date;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS terminado_daniel boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS terminado_daniel_fecha date;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS enviado_daniel boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS enviado_daniel_fecha date;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pantalla_hecha boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pantalla_hecha_fecha date;
