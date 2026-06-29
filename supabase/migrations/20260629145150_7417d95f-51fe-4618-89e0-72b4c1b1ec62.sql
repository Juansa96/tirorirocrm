-- Re-enlazar pedidos a la versión "real" del producto cuando exista un duplicado migrado vacío.
-- NO borra filas. Solo cambia producto_lead_id en pedidos y añade tag [posible-duplicado].

-- 1) Para cada pareja (real, mig) con misma clave de duplicado donde:
--    - el "real" tiene tela rellena (versión completa) y NO está enlazado a ningún pedido
--    - el "mig" SÍ está enlazado a algún pedido
--    repunta esos pedidos al real.
WITH dup_groups AS (
  SELECT lead_id, tipo, modelo, ancho, alto, precio_unitario
  FROM public.productos_lead
  GROUP BY lead_id, tipo, modelo, ancho, alto, precio_unitario
  HAVING COUNT(*) > 1
),
real_candidates AS (
  SELECT DISTINCT ON (pl.lead_id, pl.tipo, pl.modelo, pl.ancho, pl.alto, pl.precio_unitario)
    pl.id, pl.lead_id, pl.tipo, pl.modelo, pl.ancho, pl.alto, pl.precio_unitario
  FROM public.productos_lead pl
  JOIN dup_groups g USING (lead_id, tipo, modelo, ancho, alto, precio_unitario)
  WHERE COALESCE(pl.notas_producto,'') NOT ILIKE '%mig-excel-v1%'
    AND COALESCE(pl.tela,'') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.pedidos pe WHERE pe.producto_lead_id = pl.id)
  ORDER BY pl.lead_id, pl.tipo, pl.modelo, pl.ancho, pl.alto, pl.precio_unitario, pl.created_at ASC
),
mig_with_pedido AS (
  SELECT pl.id AS mig_id, pl.lead_id, pl.tipo, pl.modelo, pl.ancho, pl.alto, pl.precio_unitario
  FROM public.productos_lead pl
  JOIN dup_groups g USING (lead_id, tipo, modelo, ancho, alto, precio_unitario)
  WHERE pl.notas_producto ILIKE '%mig-excel-v1%'
    AND EXISTS (SELECT 1 FROM public.pedidos pe WHERE pe.producto_lead_id = pl.id)
)
UPDATE public.pedidos pe
SET producto_lead_id = rc.id
FROM mig_with_pedido m
JOIN real_candidates rc
  ON rc.lead_id = m.lead_id AND rc.tipo = m.tipo AND rc.modelo = m.modelo
 AND COALESCE(rc.ancho,-1) = COALESCE(m.ancho,-1)
 AND COALESCE(rc.alto,-1)  = COALESCE(m.alto,-1)
 AND rc.precio_unitario = m.precio_unitario
WHERE pe.producto_lead_id = m.mig_id;

-- 2) Marcar como "[posible-duplicado]" todas las filas que pertenezcan a un grupo duplicado
--    (excepto la que ya queremos conservar = primera por created_at del grupo).
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id, tipo, modelo, ancho, alto, precio_unitario
      ORDER BY
        (CASE WHEN COALESCE(notas_producto,'') ILIKE '%mig-excel-v1%' THEN 1 ELSE 0 END),
        (CASE WHEN COALESCE(tela,'') <> '' THEN 0 ELSE 1 END),
        created_at ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY lead_id, tipo, modelo, ancho, alto, precio_unitario) AS grp_n
  FROM public.productos_lead
)
UPDATE public.productos_lead pl
SET notas_producto = CASE
  WHEN COALESCE(pl.notas_producto,'') = '' THEN '[posible-duplicado]'
  WHEN pl.notas_producto ILIKE '%[posible-duplicado]%' THEN pl.notas_producto
  ELSE pl.notas_producto || ' [posible-duplicado]'
END
FROM ranked r
WHERE pl.id = r.id AND r.grp_n > 1 AND r.rn > 1;