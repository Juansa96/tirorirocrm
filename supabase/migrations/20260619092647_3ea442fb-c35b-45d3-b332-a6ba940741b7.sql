
-- Recalcula valor_producto y valor de un lead a partir de productos_lead + valor_envio
CREATE OR REPLACE FUNCTION public.recalc_lead_valor(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_prod numeric;
BEGIN
  SELECT COALESCE(SUM(precio_unitario * cantidad), 0)
    INTO total_prod
    FROM public.productos_lead
    WHERE lead_id = _lead_id;

  UPDATE public.leads
     SET valor_producto = total_prod,
         valor = total_prod + COALESCE(valor_envio, 0)
   WHERE id = _lead_id;
END;
$$;

-- Trigger en productos_lead: cualquier cambio recalcula el lead afectado
CREATE OR REPLACE FUNCTION public.tg_productos_lead_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_lead_valor(OLD.lead_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_lead_valor(NEW.lead_id);
    IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      PERFORM public.recalc_lead_valor(OLD.lead_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS productos_lead_recalc_valor ON public.productos_lead;
CREATE TRIGGER productos_lead_recalc_valor
AFTER INSERT OR UPDATE OR DELETE ON public.productos_lead
FOR EACH ROW EXECUTE FUNCTION public.tg_productos_lead_recalc();

-- Trigger en leads: si cambia valor_envio, recalcula valor manteniendo valor_producto
CREATE OR REPLACE FUNCTION public.tg_leads_sync_valor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.valor_envio IS DISTINCT FROM OLD.valor_envio
     OR NEW.valor_producto IS DISTINCT FROM OLD.valor_producto THEN
    NEW.valor := COALESCE(NEW.valor_producto, 0) + COALESCE(NEW.valor_envio, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_valor ON public.leads;
CREATE TRIGGER leads_sync_valor
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_leads_sync_valor();

-- Backfill único: recalcular todos los leads existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.leads LOOP
    PERFORM public.recalc_lead_valor(r.id);
  END LOOP;
END;
$$;
