
-- ── PARTE 1: Ampliar tabla pedidos ──────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS coste_envio NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliente_nombre_libre TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS precio_con_iva NUMERIC;

-- Permitir pedidos sin lead vinculado (para migración histórica y manuales)
ALTER TABLE public.pedidos ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN producto_lead_id DROP NOT NULL;

-- ── PARTE 2: Migración de datos histórica ───────────────────────────
-- Crear lead "Alejandra Blanc" si no existe (partner_ab)
INSERT INTO public.leads (nombre, vendedor, etapa, cliente_tipo, edad, origen)
SELECT 'Alejandra Blanc', 'sangradortorresjuan@gmail.com', 'Closed Won', 'partner_ab', '', 'Partner'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE LOWER(nombre) = 'alejandra blanc');

DO $mig$
DECLARE
  v_prod UUID;
  v_pedido UUID;
  v_lead UUID;
  v_lead_alicia UUID;
  v_lead_diego UUID;
  v_lead_isabel UUID;
  v_lead_cris UUID;
  v_lead_ana UUID;
  v_lead_lucia UUID;
  v_lead_ab UUID;

  -- Inserta producto + pedido + telas y devuelve nada
  -- usaremos helpers via funciones anidadas no es posible, así que inline
BEGIN
  -- Evitar doble ejecución
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE notas_pedido LIKE '%[mig-excel-v1]%') THEN
    RAISE NOTICE 'Migración ya ejecutada, saltando.';
    RETURN;
  END IF;

  SELECT id INTO v_lead_alicia FROM public.leads WHERE LOWER(nombre) = LOWER('Alicia Mascort') LIMIT 1;
  SELECT id INTO v_lead_diego  FROM public.leads WHERE LOWER(nombre) = LOWER('Diego') LIMIT 1;
  SELECT id INTO v_lead_isabel FROM public.leads WHERE LOWER(nombre) = LOWER('Isabel Pardinas') LIMIT 1;
  SELECT id INTO v_lead_cris   FROM public.leads WHERE LOWER(nombre) = LOWER('Cris Sanz') LIMIT 1;
  SELECT id INTO v_lead_ana    FROM public.leads WHERE LOWER(TRIM(nombre)) = LOWER('Ana INbodas') LIMIT 1;
  SELECT id INTO v_lead_lucia  FROM public.leads WHERE LOWER(nombre) = LOWER('Lucía García Mata') LIMIT 1;
  SELECT id INTO v_lead_ab     FROM public.leads WHERE LOWER(nombre) = LOWER('Alejandra Blanc') LIMIT 1;

  -- ════════════════ CABECEROS ════════════════

  -- 1. Almu Sangrador — Cabecero Calobra 170x120 (sin lead → nombre libre)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (NULL, 'cabecero', 'Calobra', 170, 120, 1, 270, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, cliente_nombre_libre, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, notas_pedido)
  VALUES (v_prod, NULL, 'Almu Sangrador', '2026-05-12'::timestamptz, 20, 270, true, '2026-05-12', true, '2026-05-22', true, '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Romántica 84000', 'Recibida', '2026-05-22', 0),
    (v_pedido, 'Lateral', 'Romántica 84000', 'Recibida', '2026-05-22', 1),
    (v_pedido, 'Vivo',    'Romántica 84000', 'Recibida', '2026-05-22', 2);

  -- 2. Diego Cagigas Prieto — Cabecero Conta 190x120
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_diego, 'cabecero', 'Conta', 190, 120, 1, 445, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, reserva, coste_envio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, notas_pedido)
  VALUES (v_prod, v_lead_diego, '2026-06-01'::timestamptz, 20, 445, 252.50, 60, true, '2026-06-01', true, '2026-06-17', true, '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Raya espiga verde', 'Recibida', '2026-06-10', 0),
    (v_pedido, 'Lateral', 'Raya espiga verde', 'Recibida', '2026-06-10', 1),
    (v_pedido, 'Vivo',    'Lisa granate',     'Recibida', '2026-06-17', 2);

  -- 3. Alicia Mascort — Cabecero Macarella 100x100 (1ª unidad, lleva reserva y envío)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_alicia, 'cabecero', 'Macarella', 100, 100, 1, 242.50, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, reserva, coste_envio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, notas_pedido)
  VALUES (v_prod, v_lead_alicia, '2026-06-02'::timestamptz, 20, 242.50, 348, 60, true, '2026-06-02', true, '2026-06-10', true, 'Pedido conjunto de 3 productos (reserva 348€ / 645€ total). [mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Harvest Amarilla', 'Recibida', '2026-06-10', 0),
    (v_pedido, 'Lateral', 'Harvest Amarilla', 'Recibida', '2026-06-10', 1),
    (v_pedido, 'Vivo',    'Aguamarina',       'Recibida', NULL,         2);

  -- 4. Alicia Mascort — Cabecero Macarella 100x100 (2ª unidad)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_alicia, 'cabecero', 'Macarella', 100, 100, 1, 242.50, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, notas_pedido)
  VALUES (v_prod, v_lead_alicia, '2026-06-02'::timestamptz, 20, 242.50, true, '2026-06-02', true, '2026-06-10', true, 'Pedido conjunto (reserva y envío en unidad 1). [mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Harvest Amarilla', 'Recibida', '2026-06-10', 0),
    (v_pedido, 'Lateral', 'Harvest Amarilla', 'Recibida', '2026-06-10', 1),
    (v_pedido, 'Vivo',    'Aguamarina',       'Recibida', NULL,         2);

  -- 5. Isabel Pardinas — Cabecero, modelo pendiente
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_isabel, 'cabecero', '', 1, 140, true, 'migracion-excel', 'Modelo aún por decidir. Cliente entrega telas y se encarga del transporte. [mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, notas_pedido)
  VALUES (v_prod, v_lead_isabel, '2026-06-01'::timestamptz, 20, 140, true, 'Cliente entrega telas y transporte propio. Materiales por comprar. [mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, orden) VALUES
    (v_pedido, 'Frontal', 'Beige (la facilita el cliente)', 'Pedida', 0),
    (v_pedido, 'Lateral', 'La facilita el cliente',         'Pedida', 1),
    (v_pedido, 'Vivo',    'La facilita el cliente',         'Pedida', 2);

  -- 6. Cris Sanz — Cabecero Pregonda 140x80 (junto con almohadones 13-16)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_cris, 'cabecero', 'Pregonda', 140, 80, 1, 346, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, reserva, coste_envio, tela_pedida, tela_pedida_fecha, notas_pedido)
  VALUES (v_prod, v_lead_cris, '2026-06-15'::timestamptz, 20, 346, 283, 40, true, '2026-06-15', 'Pedido conjunto con almohadones. [mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Romántica 81000',       'Pedida',   NULL,         0),
    (v_pedido, 'Lateral', 'Lamadrid Delhi flores', 'Pedida',   NULL,         1),
    (v_pedido, 'Vivo',    'Lisa granate',          'Recibida', '2026-06-17', 2);

  -- 7. Ana Inbodas — Cabecero Calobra 105x120
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ana, 'cabecero', 'Calobra', 105, 120, 1, 0, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, notas_pedido)
  VALUES (v_prod, v_lead_ana, '2026-06-15'::timestamptz, 20, 0, true, '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, orden) VALUES
    (v_pedido, 'Frontal', 'Vichy cuadros beige Casa Silverio', 'Pedida', 0),
    (v_pedido, 'Lateral', 'Vichy cuadros beige Casa Silverio', 'Pedida', 1),
    (v_pedido, 'Vivo',    'Beige',                              'Pedida', 2);

  -- 8. Ana Inbodas — Cabecero Pregonda 180x120
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ana, 'cabecero', 'Pregonda', 180, 120, 1, 0, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ana, '2026-06-15'::timestamptz, 20, 0, true, '2026-06-15', true, '2026-06-15', '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Frontal', 'Yute tierra rayas', 'Recibida', '2026-06-15', 0),
    (v_pedido, 'Lateral', 'Yute tierra rayas', 'Recibida', '2026-06-15', 1),
    (v_pedido, 'Vivo',    'Marrón claro',      'Recibida', NULL,         2);

  -- ════════════════ ALMOHADONES ════════════════

  -- 9-10. Lucía García Mata — Almohadón 40x60 ×2 (Tela lino verde, con vivo)
  FOR i IN 1..2 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_lucia, 'almohadon', 'Almohadón estándar', 40, 60, 1, 50, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, pagado_completo, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_lucia, '2026-06-02'::timestamptz, 16, 50, true, true, '2026-06-02', true, '2026-06-02', true, true, true, '2026-06-18', 'Pedido conjunto de 4 almohadones. [mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Lino verde', 'Recibida', '2026-06-02', 0),
      (v_pedido, 'Vivo',      'Lino verde', 'Recibida', '2026-06-02', 1);
  END LOOP;

  -- 11-12. Lucía García Mata — Almohadón 30x50 ×2 (Pájaros louise verde, con vivo)
  FOR i IN 1..2 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_lucia, 'almohadon', 'Almohadón estándar', 30, 50, 1, 40, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, pagado_completo, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_lucia, '2026-06-02'::timestamptz, 16, 40, true, true, '2026-06-02', true, '2026-06-10', true, true, true, '2026-06-18', 'Pedido conjunto de 4 almohadones. [mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Pájaros Louise verde', 'Recibida', '2026-06-10', 0),
      (v_pedido, 'Vivo',      'Pájaros Louise verde', 'Recibida', '2026-06-10', 1);
  END LOOP;

  -- 13-14. Cris Sanz — Almohadón 40x60 ×2 (Lino verde, sin vivo)
  FOR i IN 1..2 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_cris, 'almohadon', 'Almohadón estándar', 40, 60, 1, 50, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, pagado_completo, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_cris, '2026-06-15'::timestamptz, 17, 50, true, true, '2026-06-15', true, '2026-06-15', true, true, true, '2026-07-02', 'Pedido conjunto con cabecero y almohadones. [mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Lino verde', 'Recibida', '2026-06-15', 0);
  END LOOP;

  -- 15-16. Cris Sanz — Almohadón 30x50 ×2 (Lamadrid Delhi flores, sin vivo)
  FOR i IN 1..2 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_cris, 'almohadon', 'Almohadón estándar', 30, 50, 1, 40, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, pagado_completo, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_cris, '2026-06-15'::timestamptz, 17, 40, true, true, '2026-06-15', true, '2026-06-10', true, true, true, '2026-07-02', 'Pedido conjunto. [mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Lamadrid Delhi flores', 'Recibida', '2026-06-10', 0);
  END LOOP;

  -- ════════════════ CUBRECANAPÉS ════════════════

  -- 17-18. Alicia Mascort — Cubrecanapé liso 90x20x190 ×2 (3 lados)
  FOR i IN 1..2 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_alicia, 'otro', 'Cubrecanapé liso', 90, 190, 1, 50, true, 'migracion-excel', 'Cubrecanapé 90x20x190cm, 3 lados. [mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_alicia, '2026-06-02'::timestamptz, 20, 50, true, '2026-06-02', true, '2026-06-10', true, true, true, '2026-06-22', 'Pedido conjunto Alicia (3 productos). [mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Interior', 'Sábana blanca',     'Recibida', NULL,         0),
      (v_pedido, 'Lateral',  'Harvest amarilla',  'Recibida', '2026-06-10', 1);
  END LOOP;

  -- ════════════════ ALEJANDRA BLANC (partner, plazo 5d) ════════════════

  -- 19. Puf redondo 43x46
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ab, 'puf', 'Patos', 43, 46, 1, 85, true, 'migracion-excel', 'Puf redondo Ø43x46. [mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, factura, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ab, '2026-05-18'::timestamptz, 5, 85, 100, 'Proforma enviada', true, '2026-05-18', true, '2026-05-26', true, true, true, '2026-06-10', '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Principal', 'Rayas verticales rojas y beige', 'Recibida', '2026-05-26', 0);

  -- 20. Puf rectangular 60x40x46 (tela Flores)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ab, 'puf', 'Monteferro', 60, 46, 1, 100, true, 'migracion-excel', 'Puf rectangular 60x40x46. [mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ab, '2026-05-27'::timestamptz, 5, 100, 121, true, '2026-05-27', true, '2026-06-10', true, true, true, '2026-06-11', '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Principal', 'Flores', 'Recibida', '2026-06-10', 0);

  -- 21. Puf rectangular 60x40x46 (tela Rayas, tapizado por llevar)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ab, 'puf', 'Monteferro', 60, 46, 1, 100, true, 'migracion-excel', 'Puf rectangular 60x40x46 (Rayas). [mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ab, '2026-05-27'::timestamptz, 5, 100, 121, true, '2026-05-27', true, '2026-06-11', true, true, true, '2026-06-11', 'Tapizado por llevar al cierre del registro. [mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Principal', 'Rayas', 'Recibida', '2026-06-11', 0);

  -- 22. Puf rectangular 60x40x46 (duplicado en Excel)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ab, 'puf', 'Monteferro', 60, 46, 1, 100, true, 'migracion-excel', 'Puf rectangular 60x40x46 (Rayas — 2ª unidad). [mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ab, '2026-05-27'::timestamptz, 5, 100, 121, true, '2026-05-27', true, '2026-06-11', true, true, true, '2026-06-11', '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Principal', 'Rayas', 'Recibida', '2026-06-11', 0);

  -- 23-25. Almohadón 50x50 ×3 (tela Azul)
  FOR i IN 1..3 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_ab, 'almohadon', 'Almohadón estándar', 50, 50, 1, 18, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_ab, '2026-06-15'::timestamptz, 5, 18, 21.78, true, '2026-06-15', true, '2026-06-12', true, true, true, '2026-06-17', '[mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Azul', 'Recibida', '2026-06-12', 0);
  END LOOP;

  -- 26. Almohadón 50x50 ×1 (tela Árboles)
  INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
  VALUES (v_lead_ab, 'almohadon', 'Almohadón estándar', 50, 50, 1, 18, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
  INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
  VALUES (v_prod, v_lead_ab, '2026-06-15'::timestamptz, 5, 18, 21.78, true, '2026-06-15', true, '2026-06-12', true, true, true, '2026-06-17', '[mig-excel-v1]') RETURNING id INTO v_pedido;
  INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
    (v_pedido, 'Principal', 'Árboles', 'Recibida', '2026-06-12', 0);

  -- 27-29. Almohadón 40x60 ×3 (tela Árboles)
  FOR i IN 1..3 LOOP
    INSERT INTO public.productos_lead (lead_id, tipo, modelo, ancho, alto, cantidad, precio_unitario, caracteristicas_confirmadas, created_by, notas_producto)
    VALUES (v_lead_ab, 'almohadon', 'Almohadón estándar', 40, 60, 1, 18, true, 'migracion-excel', '[mig-excel-v1]') RETURNING id INTO v_prod;
    INSERT INTO public.pedidos (producto_lead_id, lead_id, fecha_creacion_pedido, dias_plazo, precio, precio_con_iva, tela_pedida, tela_pedida_fecha, tela_recibida, tela_recibida_fecha, estructura_hecha, tapizado_hecho, entregado, entregado_fecha, notas_pedido)
    VALUES (v_prod, v_lead_ab, '2026-06-15'::timestamptz, 5, 18, 21.78, true, '2026-06-15', true, '2026-06-12', true, true, true, '2026-06-17', '[mig-excel-v1]') RETURNING id INTO v_pedido;
    INSERT INTO public.pedido_telas (pedido_id, tipo_tela, nombre_tela, estado, fecha_recibo, orden) VALUES
      (v_pedido, 'Principal', 'Árboles', 'Recibida', '2026-06-12', 0);
  END LOOP;

END $mig$;
