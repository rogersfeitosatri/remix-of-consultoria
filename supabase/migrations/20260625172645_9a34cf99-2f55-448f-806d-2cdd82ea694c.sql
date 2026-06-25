DROP POLICY IF EXISTS "Authenticated users can upload link bio images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update link bio images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete link bio images" ON storage.objects;

CREATE POLICY "Admins can upload link bio images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'link-bio-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update link bio images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'link-bio-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'link-bio-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete link bio images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'link-bio-images' AND public.has_role(auth.uid(), 'admin'));