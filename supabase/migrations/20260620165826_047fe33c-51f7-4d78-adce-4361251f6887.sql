
-- Bloque 1: ampliar leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fecha_entrada_etapa TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS razon_urgencia TEXT DEFAULT '';

-- Trigger para actualizar fecha_entrada_etapa cuando cambia etapa
CREATE OR REPLACE FUNCTION public.tg_leads_etapa_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.fecha_entrada_etapa := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_etapa_change ON public.leads;
CREATE TRIGGER leads_etapa_change
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_leads_etapa_change();

-- Ampliar productos_lead
ALTER TABLE public.productos_lead
  ADD COLUMN IF NOT EXISTS caracteristicas_confirmadas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagado_50 BOOLEAN NOT NULL DEFAULT false;

-- Trigger para fecha_confirmacion
CREATE OR REPLACE FUNCTION public.tg_producto_confirmacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.caracteristicas_confirmadas = true AND (OLD.caracteristicas_confirmadas IS DISTINCT FROM true) THEN
    NEW.fecha_confirmacion := now();
  ELSIF NEW.caracteristicas_confirmadas = false THEN
    NEW.fecha_confirmacion := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS producto_confirmacion ON public.productos_lead;
CREATE TRIGGER producto_confirmacion
  BEFORE UPDATE ON public.productos_lead
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_producto_confirmacion();

-- Tabla pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_lead_id UUID NOT NULL REFERENCES public.productos_lead(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  fecha_creacion_pedido TIMESTAMPTZ NOT NULL DEFAULT now(),
  dias_plazo INTEGER NOT NULL DEFAULT 20,
  fecha_limite DATE,
  fecha_entrega_real DATE,
  pagado_50 BOOLEAN NOT NULL DEFAULT false,
  pago_todo_al_final BOOLEAN NOT NULL DEFAULT false,
  creado_manualmente BOOLEAN NOT NULL DEFAULT false,
  estado_pedido TEXT NOT NULL DEFAULT 'En proceso',
  tela_pedida BOOLEAN NOT NULL DEFAULT false,
  tela_pedida_fecha DATE,
  tela_recibida BOOLEAN NOT NULL DEFAULT false,
  tela_recibida_fecha DATE,
  estructura_hecha BOOLEAN NOT NULL DEFAULT false,
  estructura_hecha_fecha DATE,
  tapizado_hecho BOOLEAN NOT NULL DEFAULT false,
  tapizado_hecho_fecha DATE,
  entregado BOOLEAN NOT NULL DEFAULT false,
  entregado_fecha DATE,
  precio NUMERIC NOT NULL DEFAULT 0,
  reserva NUMERIC NOT NULL DEFAULT 0,
  pagado_completo BOOLEAN NOT NULL DEFAULT false,
  factura TEXT DEFAULT '',
  notas_pedido TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all pedidos" ON public.pedidos;
CREATE POLICY "auth all pedidos" ON public.pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger para calcular fecha_limite y updated_at
CREATE OR REPLACE FUNCTION public.tg_pedidos_fecha_limite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fecha_limite := (NEW.fecha_creacion_pedido::date + (NEW.dias_plazo || ' days')::interval)::date;
  NEW.updated_at := now();
  -- estado_pedido derivado
  IF NEW.entregado THEN
    NEW.estado_pedido := 'Entregado';
  ELSIF NEW.estructura_hecha AND NEW.tapizado_hecho THEN
    NEW.estado_pedido := 'Terminado';
  ELSE
    NEW.estado_pedido := 'En proceso';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_fecha_limite ON public.pedidos;
CREATE TRIGGER pedidos_fecha_limite
  BEFORE INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pedidos_fecha_limite();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

-- Tabla pedido_telas
CREATE TABLE IF NOT EXISTS public.pedido_telas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo_tela TEXT NOT NULL,
  nombre_tela TEXT DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Pedida',
  fecha_recibo DATE,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_telas TO authenticated;
GRANT ALL ON public.pedido_telas TO service_role;
ALTER TABLE public.pedido_telas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all pedido_telas" ON public.pedido_telas;
CREATE POLICY "auth all pedido_telas" ON public.pedido_telas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_telas;
ALTER TABLE public.pedido_telas REPLICA IDENTITY FULL;
