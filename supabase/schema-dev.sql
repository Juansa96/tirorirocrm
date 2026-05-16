-- ══════════════════════════════════════════════════════════════
-- TiroCRM — Schema completo para proyecto de desarrollo
-- Pega todo esto en el SQL Editor de tirorirocrm-dev y dale a Run
-- ══════════════════════════════════════════════════════════════

-- ── Tablas ────────────────────────────────────────────────────

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
  origen TEXT DEFAULT '',
  red_social TEXT DEFAULT '',
  fecha_hold DATE,
  valor_producto NUMERIC NOT NULL DEFAULT 0,
  valor_envio NUMERIC NOT NULL DEFAULT 0,
  fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TEXT DEFAULT '',
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

CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.productos_lead (
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

-- ── RLS (solo usuarios autenticados) ─────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all leads"     ON public.leads          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all tareas"    ON public.tareas         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read audit"    ON public.audit_log      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert audit"  ON public.audit_log      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read notas"    ON public.notas          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notas"  ON public.notas          FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update notas"  ON public.notas          FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete notas"  ON public.notas          FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth read prod"     ON public.productos_lead FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert prod"   ON public.productos_lead FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update prod"   ON public.productos_lead FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete prod"   ON public.productos_lead FOR DELETE TO authenticated USING (true);

-- ── Función updated_at ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Trigger de auditoría en leads ─────────────────────────────

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user TEXT;
BEGIN
  v_user := COALESCE((auth.jwt() ->> 'email'), 'sistema');
  IF NEW.etapa     IS DISTINCT FROM OLD.etapa     THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'etapa',    OLD.etapa,    NEW.etapa,    v_user); END IF;
  IF NEW.valor     IS DISTINCT FROM OLD.valor     THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'valor',    OLD.valor::TEXT, NEW.valor::TEXT, v_user); END IF;
  IF NEW.vendedor  IS DISTINCT FROM OLD.vendedor  THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'vendedor', OLD.vendedor, NEW.vendedor, v_user); END IF;
  IF NEW.nombre    IS DISTINCT FROM OLD.nombre    THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'nombre',   OLD.nombre,   NEW.nombre,   v_user); END IF;
  IF NEW.email     IS DISTINCT FROM OLD.email     THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'email',    OLD.email,    NEW.email,    v_user); END IF;
  IF NEW.telefono  IS DISTINCT FROM OLD.telefono  THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'telefono', OLD.telefono, NEW.telefono, v_user); END IF;
  IF NEW.ciudad    IS DISTINCT FROM OLD.ciudad    THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'ciudad',   OLD.ciudad,   NEW.ciudad,   v_user); END IF;
  IF NEW.producto  IS DISTINCT FROM OLD.producto  THEN INSERT INTO public.audit_log(tabla,lead_id,campo,valor_anterior,valor_nuevo,usuario) VALUES ('leads',NEW.id,'producto', OLD.producto, NEW.producto, v_user); END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER leads_audit AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();

REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()   FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- ── Realtime ──────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productos_lead;

ALTER TABLE public.leads         REPLICA IDENTITY FULL;
ALTER TABLE public.tareas        REPLICA IDENTITY FULL;
ALTER TABLE public.notas         REPLICA IDENTITY FULL;
ALTER TABLE public.productos_lead REPLICA IDENTITY FULL;
