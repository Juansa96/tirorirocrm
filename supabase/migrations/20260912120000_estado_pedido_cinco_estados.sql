-- Cinco estados de pedido, uno solo a la vez:
--   Pendiente → En marcha → Terminado → Recogido → Entregado al cliente
--
-- La app DERIVA el estado de campos que ya existen (ver estadoDePedido en
-- src/lib/types.ts), así que funciona con o sin esta migración. Aquí se amplía
-- la columna `estado_pedido` (que la rellenaba un trigger con solo tres
-- valores: "En proceso" / "Terminado" / "Entregado") para que guarde el mismo
-- estado que enseña la app, y se migran los pedidos actuales sin perder datos:
--   · "Entregado"  → "Entregado al cliente"   (entregado = true)
--   · "Terminado"  → "Terminado"              (sigue igual)
--   · "En proceso" → "En marcha" si el tapicero lo había empezado
--                    ("@iniciado" en pasos_tapicero); si no, "Pendiente".
-- "Recogido" se marca con la clave "@recogido" dentro de pasos_tapicero (JSONB
-- existente): NO hay columnas nuevas.
CREATE OR REPLACE FUNCTION public.tg_pedidos_fecha_limite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fecha_limite := (NEW.fecha_creacion_pedido::date + (NEW.dias_plazo || ' days')::interval)::date;
  NEW.updated_at := now();
  -- estado_pedido derivado (misma regla que estadoDePedido en la app)
  IF COALESCE(NEW.entregado, false) THEN
    NEW.estado_pedido := 'Entregado al cliente';
  ELSIF COALESCE(NEW.pasos_tapicero->>'@recogido', '') <> '' THEN
    NEW.estado_pedido := 'Recogido';
  ELSIF COALESCE(NEW.terminado_tapicero, false)
        OR COALESCE(NEW.terminado_daniel, false)
        OR COALESCE(NEW.pantalla_hecha, false) THEN
    NEW.estado_pedido := 'Terminado';
  ELSIF COALESCE(NEW.pasos_tapicero->>'@iniciado', '') <> '' THEN
    NEW.estado_pedido := 'En marcha';
  ELSE
    NEW.estado_pedido := 'Pendiente';
  END IF;
  RETURN NEW;
END;
$$;

-- Los pedidos nuevos nacen "Pendiente".
ALTER TABLE public.pedidos ALTER COLUMN estado_pedido SET DEFAULT 'Pendiente';

-- Recalcular el estado de los pedidos existentes (un UPDATE no-op dispara el trigger).
UPDATE public.pedidos SET updated_at = updated_at;
