
DROP POLICY IF EXISTS lead_fotos_all_anon ON public.lead_fotos;
DROP POLICY IF EXISTS lead_fotos_delete ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_update ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_insert ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_select ON storage.objects;

CREATE POLICY lead_fotos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lead-fotos');
CREATE POLICY lead_fotos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-fotos');
CREATE POLICY lead_fotos_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lead-fotos') WITH CHECK (bucket_id = 'lead-fotos');
CREATE POLICY lead_fotos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lead-fotos');

REVOKE ALL ON public.lead_fotos FROM anon;
