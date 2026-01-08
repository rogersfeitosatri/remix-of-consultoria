-- Create storage bucket for link bio images
INSERT INTO storage.buckets (id, name, public) VALUES ('link-bio-images', 'link-bio-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload link bio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'link-bio-images');

-- Allow authenticated users to update their images
CREATE POLICY "Authenticated users can update link bio images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'link-bio-images');

-- Allow authenticated users to delete their images
CREATE POLICY "Authenticated users can delete link bio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'link-bio-images');

-- Allow public to view images
CREATE POLICY "Public can view link bio images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'link-bio-images');