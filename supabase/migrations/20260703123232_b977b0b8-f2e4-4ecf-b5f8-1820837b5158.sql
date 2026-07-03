
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cobrado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_cobro date;

-- Auditoría: registrar cambios en cobrado / fecha_cobro
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user TEXT;
BEGIN
  v_user := COALESCE((auth.jwt() ->> 'email'), 'sistema');

  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'etapa', OLD.etapa, NEW.etapa, v_user);
  END IF;
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'valor', OLD.valor::TEXT, NEW.valor::TEXT, v_user);
  END IF;
  IF NEW.valor_producto IS DISTINCT FROM OLD.valor_producto THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'valor_producto', OLD.valor_producto::TEXT, NEW.valor_producto::TEXT, v_user);
  END IF;
  IF NEW.valor_envio IS DISTINCT FROM OLD.valor_envio THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'valor_envio', OLD.valor_envio::TEXT, NEW.valor_envio::TEXT, v_user);
  END IF;
  IF NEW.vendedor IS DISTINCT FROM OLD.vendedor THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'vendedor', OLD.vendedor, NEW.vendedor, v_user);
  END IF;
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'nombre', OLD.nombre, NEW.nombre, v_user);
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'email', OLD.email, NEW.email, v_user);
  END IF;
  IF NEW.telefono IS DISTINCT FROM OLD.telefono THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'telefono', OLD.telefono, NEW.telefono, v_user);
  END IF;
  IF NEW.ciudad IS DISTINCT FROM OLD.ciudad THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'ciudad', OLD.ciudad, NEW.ciudad, v_user);
  END IF;
  IF NEW.producto IS DISTINCT FROM OLD.producto THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'producto', OLD.producto, NEW.producto, v_user);
  END IF;
  IF NEW.fecha_hold IS DISTINCT FROM OLD.fecha_hold THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'fecha_hold', OLD.fecha_hold::TEXT, NEW.fecha_hold::TEXT, v_user);
  END IF;
  IF NEW.red_social IS DISTINCT FROM OLD.red_social THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'red_social', OLD.red_social, NEW.red_social, v_user);
  END IF;
  IF NEW.cobrado IS DISTINCT FROM OLD.cobrado THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'cobrado', OLD.cobrado::TEXT, NEW.cobrado::TEXT, v_user);
  END IF;
  IF NEW.fecha_cobro IS DISTINCT FROM OLD.fecha_cobro THEN
    INSERT INTO public.audit_log(tabla, lead_id, campo, valor_anterior, valor_nuevo, usuario)
    VALUES ('leads', NEW.id, 'fecha_cobro', OLD.fecha_cobro::TEXT, NEW.fecha_cobro::TEXT, v_user);
  END IF;
  RETURN NEW;
END;
$function$;

-- Añadir Banco Oyambre al catálogo
INSERT INTO public.catalogo_productos (tipo, modelo, descripcion, precio_desde, activo, orden)
SELECT 'Banco', 'Oyambre', 'Banco tapizado a medida. Alto 45 cm, fondo 33 cm. Precio fijo por medida.', 200, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_productos WHERE tipo = 'Banco' AND modelo = 'Oyambre'
);
