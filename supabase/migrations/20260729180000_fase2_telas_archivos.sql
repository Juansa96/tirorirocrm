-- ══════════════════════════════════════════════════════════════════════════
-- Fase 2 — Telas (frontal/lateral/vivo con foto), biblioteca de telas,
-- estado/envío del pedido y archivos (plantilla + CTT).
--
-- Aditiva. No toca datos ni el catálogo de productos existente.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Biblioteca de telas SUBIDAS a mano (las de la web se leen en vivo) ───────
CREATE TABLE IF NOT EXISTS public.telas_biblioteca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nombre_norm TEXT NOT NULL,                    -- normalizado para dedup/búsqueda
  foto_url TEXT,                                -- URL pública (puede ser NULL: "sin foto")
  coleccion TEXT NOT NULL DEFAULT 'otra',       -- basica | premium | otra
  origen TEXT NOT NULL DEFAULT 'subida',        -- subida | web
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS telas_biblioteca_norm_unq ON public.telas_biblioteca(nombre_norm);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telas_biblioteca TO authenticated;
GRANT ALL ON public.telas_biblioteca TO service_role;
ALTER TABLE public.telas_biblioteca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS telas_biblioteca_equipo ON public.telas_biblioteca;
CREATE POLICY telas_biblioteca_equipo ON public.telas_biblioteca FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());

-- ── Telas por pedido: enlace a foto/biblioteca (denormalizado para el panel) ─
-- pedido_telas ya tiene tipo_tela (Frontal/Lateral/Vivo), nombre_tela y estado.
-- Añadimos la foto y (opcional) el id de biblioteca. El tapicero lee la foto
-- directamente aquí, sin acceder a la biblioteca.
ALTER TABLE public.pedido_telas
  ADD COLUMN IF NOT EXISTS tela_foto_url TEXT,
  ADD COLUMN IF NOT EXISTS tela_biblioteca_id UUID REFERENCES public.telas_biblioteca(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS misma_que_frontal BOOLEAN NOT NULL DEFAULT false;

-- ── Estado / envío / acciones a nivel de pedido ─────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS enviado_tapicero BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviado_tapicero_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tela_estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (tela_estado IN ('pendiente','enviada','recibida')),
  ADD COLUMN IF NOT EXISTS tela_estado_por TEXT,
  ADD COLUMN IF NOT EXISTS tela_estado_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminado_tapicero BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terminado_tapicero_por TEXT,
  ADD COLUMN IF NOT EXISTS terminado_tapicero_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS montaje TEXT;   -- 'colgar' | 'apoyar' | NULL

-- ── Archivos por pedido (plantilla de corte + etiquetas CTT) ────────────────
CREATE TABLE IF NOT EXISTS public.pedido_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('plantilla','etiqueta_ctt')),
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  subido_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_archivos_pedido_idx ON public.pedido_archivos(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_archivos TO authenticated;
GRANT ALL ON public.pedido_archivos TO service_role;
ALTER TABLE public.pedido_archivos ENABLE ROW LEVEL SECURITY;
-- Equipo total; tapicero SOLO LECTURA de los archivos de SUS pedidos.
DROP POLICY IF EXISTS pedido_archivos_equipo ON public.pedido_archivos;
CREATE POLICY pedido_archivos_equipo ON public.pedido_archivos FOR ALL TO authenticated
  USING (public.es_equipo()) WITH CHECK (public.es_equipo());
DROP POLICY IF EXISTS pedido_archivos_tapicero_read ON public.pedido_archivos;
CREATE POLICY pedido_archivos_tapicero_read ON public.pedido_archivos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_archivos.pedido_id AND p.tapicero_id = public.mi_tapicero_id()));

-- ── Buckets de almacenamiento (públicos de lectura para poder mostrar/descargar) ─
INSERT INTO storage.buckets (id, name, public) VALUES ('telas','telas', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pedido-archivos','pedido-archivos', true)
  ON CONFLICT (id) DO NOTHING;

-- Subida/gestión: solo equipo. Lectura pública (los buckets son public), así el
-- tapicero puede ver la foto y descargar el archivo por URL.
DROP POLICY IF EXISTS telas_equipo_write ON storage.objects;
CREATE POLICY telas_equipo_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='telas' AND public.es_equipo()) WITH CHECK (bucket_id='telas' AND public.es_equipo());
DROP POLICY IF EXISTS pedido_archivos_equipo_write ON storage.objects;
CREATE POLICY pedido_archivos_equipo_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='pedido-archivos' AND public.es_equipo()) WITH CHECK (bucket_id='pedido-archivos' AND public.es_equipo());
