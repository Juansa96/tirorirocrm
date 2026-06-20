
-- 1) Recompute fecha_entrada_etapa from audit_log history
UPDATE public.leads l SET fecha_entrada_etapa = COALESCE(
  (SELECT MAX(a.created_at) FROM public.audit_log a
    WHERE a.lead_id = l.id AND a.campo = 'etapa'),
  l.fecha_creacion::timestamptz,
  l.created_at
);

-- 2) Catalogo de productos
CREATE TABLE public.catalogo_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  modelo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  precio_desde NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_productos TO authenticated;
GRANT ALL ON public.catalogo_productos TO service_role;

ALTER TABLE public.catalogo_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all catalogo" ON public.catalogo_productos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.catalogo_productos (tipo, modelo, descripcion, precio_desde, activo, orden) VALUES
('Cabecero', 'Calobra', 'Forma recta y líneas limpias. El más versátil.', 225, true, 1),
('Cabecero', 'Pregonda', 'Remate en arco suave. Aporta calidez con elegancia.', 225, true, 2),
('Cabecero', 'Macarella', 'Corona simple con ondulación central. Carácter escultórico.', 225, true, 3),
('Cabecero', 'Conta', 'Corona doble con dos niveles escalonados.', 225, true, 4),
('Cabecero', 'Barbaria', 'Corona quíntuple con cinco arcos. Mucha presencia.', 225, true, 5),
('Puf', 'Patos', 'Cúbico, tapizado a mano y a medida.', 125, true, 1),
('Puf', 'Monteferro', 'Redondo, cómodo y mullido.', 125, true, 2),
('Mesa de centro', 'Cabo de Palos', 'Mesa cúbica tapizada sin patas.', 280, true, 1),
('Mesa de centro', 'Calblanque', 'Próximamente.', 280, false, 2),
('Pantalla de lámpara', 'Almanzor', 'Cilíndrica. La más clásica y versátil.', 25, true, 1),
('Pantalla de lámpara', 'Tormes', 'Cuadrada. Líneas limpias y contemporáneas.', 25, true, 2),
('Pantalla de lámpara', 'La Serrota', 'Rectangular. Perfecta para apliques de pared.', 25, true, 3),
('Pantalla de lámpara', 'Gredos', 'Próximamente.', 25, false, 4),
('Pantalla de lámpara', 'La Paramera', 'Próximamente.', 25, false, 5),
('Pantalla de lámpara', 'La Galana', 'Próximamente.', 25, false, 6),
('Almohadón', 'Almohadón estándar', 'Tapizado a medida, varios tamaños (30x50, 40x60, 50x50 cm).', 18, true, 1),
('Cubrecanapé', 'Cubrecanapé liso', 'A medida, varios formatos (recto, con lados).', 50, true, 1);

-- 3) cliente_tipo
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cliente_tipo TEXT NOT NULL DEFAULT 'normal';

UPDATE public.leads
  SET cliente_tipo = 'partner_ab'
  WHERE nombre ILIKE '%alejandra blanc%' OR nombre ILIKE '%alejandra%blanc%';
