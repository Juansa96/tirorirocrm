-- El estado del pedido («En proceso» / «Terminado» / «Entregado») lo deriva un
-- trigger. Hasta ahora «Terminado» dependía de `estructura_hecha` + `tapizado_hecho`,
-- dos hitos que NO existen en la ruta de producción real (el flujo usa
-- solicitado / pedir-recibir tela / Daniel / entregado). Por eso «Terminado»
-- casi nunca se alcanzaba (estado fantasma).
--
-- Aquí lo recableamos a los hitos REALES: el pedido está «Terminado» cuando el
-- tapicero/Daniel lo marca terminado (o la pantalla está hecha) y aún no se ha
-- entregado. Se conserva el cálculo de fecha_limite y updated_at. Aditiva.
CREATE OR REPLACE FUNCTION public.tg_pedidos_fecha_limite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fecha_limite := (NEW.fecha_creacion_pedido::date + (NEW.dias_plazo || ' days')::interval)::date;
  NEW.updated_at := now();
  -- estado_pedido derivado de los hitos reales
  IF NEW.entregado THEN
    NEW.estado_pedido := 'Entregado';
  ELSIF COALESCE(NEW.terminado_daniel, false)
        OR COALESCE(NEW.terminado_tapicero, false)
        OR COALESCE(NEW.pantalla_hecha, false) THEN
    NEW.estado_pedido := 'Terminado';
  ELSE
    NEW.estado_pedido := 'En proceso';
  END IF;
  RETURN NEW;
END;
$$;

-- Recalcular el estado de los pedidos existentes (un UPDATE no-op dispara el trigger).
UPDATE public.pedidos SET updated_at = updated_at;
