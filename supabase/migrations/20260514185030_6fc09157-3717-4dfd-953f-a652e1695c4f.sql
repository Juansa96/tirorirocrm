
-- Tables
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  producto TEXT DEFAULT '',
  vendedor TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'Discovery',
  valor NUMERIC NOT NULL DEFAULT 0,
  fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  fecha DATE NOT NULL,
  vendedor TEXT NOT NULL,
  completada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla TEXT NOT NULL,
  lead_id UUID,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all tareas" ON public.tareas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read audit" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger for leads
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user TEXT;
BEGIN
  v_user := COALESCE(
    (auth.jwt() ->> 'email'),
    'sistema'
  );
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'etapa', OLD.etapa, NEW.etapa, v_user);
  END IF;
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'valor', OLD.valor::TEXT, NEW.valor::TEXT, v_user);
  END IF;
  IF NEW.vendedor IS DISTINCT FROM OLD.vendedor THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'vendedor', OLD.vendedor, NEW.vendedor, v_user);
  END IF;
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'nombre', OLD.nombre, NEW.nombre, v_user);
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'email', OLD.email, NEW.email, v_user);
  END IF;
  IF NEW.telefono IS DISTINCT FROM OLD.telefono THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'telefono', OLD.telefono, NEW.telefono, v_user);
  END IF;
  IF NEW.ciudad IS DISTINCT FROM OLD.ciudad THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'ciudad', OLD.ciudad, NEW.ciudad, v_user);
  END IF;
  IF NEW.producto IS DISTINCT FROM OLD.producto THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'producto', OLD.producto, NEW.producto, v_user);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER leads_audit AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.tareas REPLICA IDENTITY FULL;
