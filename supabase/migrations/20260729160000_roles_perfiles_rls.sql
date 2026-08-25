-- ══════════════════════════════════════════════════════════════════════════
-- Fase 1 — Roles, perfiles y aislamiento por rol (RLS).
--
-- HOY todas las tablas tienen políticas abiertas ("authenticated USING(true)"):
-- cualquier usuario logueado ve y edita TODO. Esto introduce ROLES reales y
-- reescribe las políticas para que:
--   · admin / equipo  → acceso total (igual que hoy).
--   · tapicero        → SOLO lectura de SUS pedidos (y sus productos/telas);
--                       nada de leads, precios, tareas, otros tapiceros, etc.
--
-- Las escrituras del tapicero ("tela recibida" / "terminado") NO se hacen por
-- RLS de tabla: irán por una ruta de servidor validada (Fase 3), así el
-- tapicero queda en SOLO LECTURA a nivel de BD.
--
-- No destructiva con los datos. Reversible (bloque REVERT comentado al final).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1) Tabla de perfiles (usuario auth → rol) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'equipo' CHECK (rol IN ('admin','equipo','tapicero')),
  tapicero_id UUID REFERENCES public.tapiceros(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.perfiles TO authenticated;
GRANT ALL ON public.perfiles TO service_role;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- ── 2) Helpers (SECURITY DEFINER: leen perfiles saltándose su propia RLS) ────
CREATE OR REPLACE FUNCTION public.mi_rol() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT rol FROM public.perfiles WHERE id = auth.uid() AND activo $$;

CREATE OR REPLACE FUNCTION public.es_equipo() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (
     SELECT 1 FROM public.perfiles
     WHERE id = auth.uid() AND activo AND rol IN ('admin','equipo')
   ) $$;

CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (
     SELECT 1 FROM public.perfiles
     WHERE id = auth.uid() AND activo AND rol = 'admin'
   ) $$;

CREATE OR REPLACE FUNCTION public.mi_tapicero_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT tapicero_id FROM public.perfiles
   WHERE id = auth.uid() AND activo AND rol = 'tapicero' $$;

GRANT EXECUTE ON FUNCTION public.mi_rol(), public.es_equipo(), public.es_admin(), public.mi_tapicero_id() TO authenticated;

-- ── 3) Políticas de perfiles ────────────────────────────────────────────────
-- Cada uno lee su propio perfil; el equipo lee todos. Las escrituras van por
-- service_role (rutas de servidor de gestión de usuarios), no por RLS.
DROP POLICY IF EXISTS perfiles_read ON public.perfiles;
CREATE POLICY perfiles_read ON public.perfiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.es_equipo());

-- ── 4) Semilla: el equipo (los 4) como admin (los 4 gestionan usuarios) ──────
INSERT INTO public.perfiles (id, rol, activo)
SELECT u.id, 'admin', true FROM auth.users u
WHERE lower(u.email) IN (
  'isangradortorres@gmail.com',
  'rocionavarreteurdiales98@gmail.com',
  'sangradortorresjuan@gmail.com',
  'bea.gyerro@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET rol = 'admin', activo = true;

-- ── 5) REWORK DE RLS ────────────────────────────────────────────────────────
-- Patrón: equipo → acceso total; tapicero → solo lo suyo (o nada).

-- leads: solo equipo
DROP POLICY IF EXISTS "auth all leads" ON public.leads;
CREATE POLICY leads_equipo ON public.leads FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- tareas: solo equipo
DROP POLICY IF EXISTS "auth all tareas" ON public.tareas;
CREATE POLICY tareas_equipo ON public.tareas FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- audit_log: solo equipo (lectura + inserción)
DROP POLICY IF EXISTS "auth read audit" ON public.audit_log;
DROP POLICY IF EXISTS "auth insert audit" ON public.audit_log;
CREATE POLICY audit_equipo_read ON public.audit_log FOR SELECT TO authenticated USING (public.es_equipo());
CREATE POLICY audit_equipo_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (public.es_equipo());

-- notas: solo equipo
DROP POLICY IF EXISTS "auth read notas" ON public.notas;
DROP POLICY IF EXISTS "auth insert notas" ON public.notas;
DROP POLICY IF EXISTS "auth update notas" ON public.notas;
DROP POLICY IF EXISTS "auth delete notas" ON public.notas;
CREATE POLICY notas_equipo ON public.notas FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- catalogo_productos: solo equipo
DROP POLICY IF EXISTS "auth all catalogo" ON public.catalogo_productos;
CREATE POLICY catalogo_equipo ON public.catalogo_productos FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- lead_fotos: authenticated → solo equipo (se conserva la política anon existente)
DROP POLICY IF EXISTS "lead_fotos_all_auth" ON public.lead_fotos;
CREATE POLICY lead_fotos_equipo ON public.lead_fotos FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- pedidos: equipo total; tapicero SOLO LECTURA de los suyos
DROP POLICY IF EXISTS "auth all pedidos" ON public.pedidos;
CREATE POLICY pedidos_equipo ON public.pedidos FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());
CREATE POLICY pedidos_tapicero_read ON public.pedidos FOR SELECT TO authenticated
  USING (tapicero_id = public.mi_tapicero_id());

-- productos_lead: equipo total; tapicero SELECT de los de sus pedidos
DROP POLICY IF EXISTS "auth read prod" ON public.productos_lead;
DROP POLICY IF EXISTS "auth insert prod" ON public.productos_lead;
DROP POLICY IF EXISTS "auth update prod" ON public.productos_lead;
DROP POLICY IF EXISTS "auth delete prod" ON public.productos_lead;
CREATE POLICY prod_equipo ON public.productos_lead FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());
CREATE POLICY prod_tapicero_read ON public.productos_lead FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.producto_lead_id = productos_lead.id
      AND p.tapicero_id = public.mi_tapicero_id()
  ));

-- pedido_telas: equipo total; tapicero SELECT de las de sus pedidos
DROP POLICY IF EXISTS "auth all pedido_telas" ON public.pedido_telas;
CREATE POLICY pedido_telas_equipo ON public.pedido_telas FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());
CREATE POLICY pedido_telas_tapicero_read ON public.pedido_telas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_telas.pedido_id
      AND p.tapicero_id = public.mi_tapicero_id()
  ));

-- tapiceros: equipo total; tapicero SELECT de su propia ficha
DROP POLICY IF EXISTS "auth all tapiceros" ON public.tapiceros;
CREATE POLICY tapiceros_equipo ON public.tapiceros FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());
CREATE POLICY tapiceros_tapicero_read ON public.tapiceros FOR SELECT TO authenticated
  USING (id = public.mi_tapicero_id());

-- storage: bucket lead-fotos → authenticated solo equipo (anon/publicos sin cambios)
DROP POLICY IF EXISTS lead_fotos_select ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_insert ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_update ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_delete ON storage.objects;
CREATE POLICY lead_fotos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lead-fotos' AND public.es_equipo());
CREATE POLICY lead_fotos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-fotos' AND public.es_equipo());
CREATE POLICY lead_fotos_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lead-fotos' AND public.es_equipo()) WITH CHECK (bucket_id = 'lead-fotos' AND public.es_equipo());
CREATE POLICY lead_fotos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lead-fotos' AND public.es_equipo());

-- ── COMPROBACIONES sugeridas (ejecutar aparte tras aplicar) ──────────────────
-- (a) ¿Algún usuario auth se quedaría sin perfil (perdería acceso)?  Debe listar
--     solo, como mucho, tapiceros aún no dados de alta:
--   SELECT u.email, p.rol FROM auth.users u LEFT JOIN public.perfiles p ON p.id=u.id ORDER BY 2;
-- (b) El equipo debe seguir viendo todo AL ENTRAR EN LA APP (no en el SQL editor,
--     que corre como service_role). Verificar con un login real del equipo.

-- ── REVERT (si algo va mal, restaura el acceso abierto anterior) ─────────────
-- DROP POLICY IF EXISTS leads_equipo ON public.leads;
-- CREATE POLICY "auth all leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ...(equivalente para el resto)...  (pídeme el revert completo si lo necesitas)
