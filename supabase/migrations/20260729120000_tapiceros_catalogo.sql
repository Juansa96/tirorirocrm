-- Tarea 1 (Parte A) — Catálogo de tapiceros + asignación de pedidos.
--
-- Hasta ahora la asignación a "Daniel" no era un dato: estaba cableada en el
-- flujo de producción (columnas *_daniel y etiquetas "… a Daniel"). Esta
-- migración introduce un catálogo real de tapiceros y una columna de
-- asignación en pedidos, para poder repartir el trabajo entre varias personas.
--
-- Es NO destructiva: crea tabla y columna nuevas y siembra el catálogo. NO
-- toca ningún pedido existente (tapicero_id queda NULL en todos). El backfill
-- de los pedidos históricos a "Daniel Vytas" va en una migración separada y
-- reversible (20260729121000_backfill_tapicero_daniel_vytas.sql), que solo se
-- aplica tras confirmar el recuento de registros afectados.

-- ── Catálogo de tapiceros ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tapiceros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tapiceros TO authenticated;
GRANT ALL ON public.tapiceros TO service_role;

ALTER TABLE public.tapiceros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all tapiceros" ON public.tapiceros;
CREATE POLICY "auth all tapiceros" ON public.tapiceros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Semilla con IDs fijos para que el backfill pueda referenciar a Daniel Vytas
-- de forma estable. Hay dos Daniel: SIEMPRE se muestran con nombre+apellido.
INSERT INTO public.tapiceros (id, nombre, apellido, activo, orden) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Daniel', 'Vytas', true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Daniel', 'Garpe', true, 2),
  ('33333333-3333-3333-3333-333333333333', 'Leonardo', '',     true, 3),
  ('44444444-4444-4444-4444-444444444444', 'Wendy',    '',     true, 4)
ON CONFLICT (id) DO NOTHING;

-- ── Asignación en pedidos ───────────────────────────────────────────────────
-- Nullable y ON DELETE SET NULL: dar de baja (o borrar) un tapicero nunca
-- rompe los pedidos históricos que tenía asignados. La baja habitual es
-- lógica (activo=false), que conserva la asignación intacta.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS tapicero_id UUID
    REFERENCES public.tapiceros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_tapicero_id ON public.pedidos(tapicero_id);
