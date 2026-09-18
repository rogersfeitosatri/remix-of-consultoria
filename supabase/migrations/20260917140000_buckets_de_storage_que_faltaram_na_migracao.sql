-- Os três buckets de storage do app, que não vieram na migração para este
-- projeto: `storage.buckets` está vazio aqui, e nenhuma política existe em
-- `storage.objects`. Com isso, todo upload responde "Bucket not found" — foi o
-- que quebrou ao anexar imagem a um item do Link da Bio.
--
-- Recriados exatamente como nas migrações originais:
--   20260108025641 (link-bio-images), 20260129170127 (athlete-attachments),
--   20260212173303 (broadcast-media).
--
-- Idempotente de propósito: buckets com ON CONFLICT, políticas com DROP IF
-- EXISTS antes do CREATE, para poder rodar de novo sem quebrar.

-- ============ buckets ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('link-bio-images', 'link-bio-images', true),
  ('broadcast-media', 'broadcast-media', true),
  ('athlete-attachments', 'athlete-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ============ link-bio-images (público) ============
-- Imagens dos itens do Link da Bio e a logo da personalização de layout.
DROP POLICY IF EXISTS "Authenticated users can upload link bio images" ON storage.objects;
CREATE POLICY "Authenticated users can upload link bio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'link-bio-images');

DROP POLICY IF EXISTS "Authenticated users can update link bio images" ON storage.objects;
CREATE POLICY "Authenticated users can update link bio images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'link-bio-images');

DROP POLICY IF EXISTS "Authenticated users can delete link bio images" ON storage.objects;
CREATE POLICY "Authenticated users can delete link bio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'link-bio-images');

DROP POLICY IF EXISTS "Public can view link bio images" ON storage.objects;
CREATE POLICY "Public can view link bio images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'link-bio-images');

-- ============ broadcast-media (público) ============
-- Mídia das transmissões de WhatsApp.
DROP POLICY IF EXISTS "Admins can upload broadcast media" ON storage.objects;
CREATE POLICY "Admins can upload broadcast media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'broadcast-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Broadcast media is publicly accessible" ON storage.objects;
CREATE POLICY "Broadcast media is publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'broadcast-media');

-- ============ athlete-attachments (privado) ============
-- Anexos da anamnese. Bucket fechado: leitura só por URL assinada.
DROP POLICY IF EXISTS "Admins can upload athlete attachments" ON storage.objects;
CREATE POLICY "Admins can upload athlete attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'athlete-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view athlete attachments" ON storage.objects;
CREATE POLICY "Admins can view athlete attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'athlete-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete athlete attachments" ON storage.objects;
CREATE POLICY "Admins can delete athlete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'athlete-attachments' AND auth.uid() IS NOT NULL);
