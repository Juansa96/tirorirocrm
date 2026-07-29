-- Reasignación de tapicero por paso (relevo a mitad de proceso).
--
-- Cuando un pedido cambia de tapicero a mitad (p. ej. lo empieza Daniel y lo
-- termina Wendy), los pasos YA HECHOS deben conservar quién los hizo, y el
-- paso actual + los posteriores pasan al nuevo tapicero.
--
-- Para ello guardamos, por pedido, un sello por paso: { <stepKey>: <tapicero_id> }.
-- Solo se rellena al REASIGNAR: los pasos hechos y aún sin sello se sellan con
-- el tapicero saliente. Los pasos sin sello se muestran con el tapicero actual.
--
-- No destructiva: columna nueva con default '{}'. No toca ningún pedido.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pasos_tapicero JSONB NOT NULL DEFAULT '{}'::jsonb;
