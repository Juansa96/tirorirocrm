-- Tarea 1 (Parte B) — Backfill AUTORIZADO: pedidos históricos → Daniel Vytas.
--
-- Autorización explícita del cliente: todos los pedidos que hoy figuran
-- asignados a "Daniel" a secas corresponden a Daniel Vytas. Daniel Garpe es
-- tapicero nuevo y NO recibe históricos.
--
-- Alcance elegido: EXCLUIR pantallas de lámpara. Las pantallas se hacen en
-- casa (flujo corto sin tapicero), así que quedan sin asignar (tapicero_id
-- NULL), que es lo correcto.
--
-- Seguridad / reversibilidad:
--   · Solo asigna a pedidos SIN asignar (tapicero_id IS NULL). En el momento
--     de este backfill TODOS los pedidos están sin asignar (la asignación es
--     una función nueva), así que esto equivale a "todos los históricos que no
--     son pantalla". El guard IS NULL hace la migración idempotente y evita
--     pisar cualquier asignación manual futura.
--   · Reversión: el bloque comentado del final devuelve esas filas a NULL.
--     Ejecutarlo solo tiene sentido justo tras el deploy, antes de empezar a
--     asignar Daniel Vytas a pedidos nuevos a mano.
--
-- Nº de registros afectados = resultado de:
--   SELECT count(*) FROM public.pedidos p
--   LEFT JOIN public.productos_lead pl ON pl.id = p.producto_lead_id
--   WHERE p.tapicero_id IS NULL AND coalesce(lower(pl.tipo),'') <> 'pantalla';

UPDATE public.pedidos p
SET tapicero_id = '11111111-1111-1111-1111-111111111111'  -- Daniel Vytas
WHERE p.tapicero_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.productos_lead pl
    WHERE pl.id = p.producto_lead_id
      AND lower(pl.tipo) = 'pantalla'
  );

-- ───────────────────────── REVERSIÓN (rollback manual) ─────────────────────
-- UPDATE public.pedidos
-- SET tapicero_id = NULL
-- WHERE tapicero_id = '11111111-1111-1111-1111-111111111111';
