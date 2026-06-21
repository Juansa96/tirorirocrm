
CREATE POLICY "lead_fotos_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'lead-fotos');

CREATE POLICY "lead_fotos_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'lead-fotos');

CREATE POLICY "lead_fotos_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'lead-fotos') WITH CHECK (bucket_id = 'lead-fotos');

CREATE POLICY "lead_fotos_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'lead-fotos');
