
-- 1) Fix athlete-attachments storage ownership policies
DROP POLICY IF EXISTS "Owners can view athlete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload athlete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete athlete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update athlete attachments" ON storage.objects;

CREATE POLICY "Owners can view athlete attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
);

CREATE POLICY "Owners can upload athlete attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
);

CREATE POLICY "Owners can update athlete attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
);

CREATE POLICY "Owners can delete athlete attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
);

-- 2) call_bookings: validate active link on anon insert
DROP POLICY IF EXISTS "Public creates bookings" ON public.call_bookings;
CREATE POLICY "Public creates bookings"
ON public.call_bookings FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.call_scheduling_links csl
    WHERE csl.id = scheduling_link_id
      AND csl.status = 'active'
  )
);

-- 3) strategic_call_responses: validate active call on public insert (FK column is call_id)
DROP POLICY IF EXISTS "Anyone can insert strategic call responses" ON public.strategic_call_responses;
CREATE POLICY "Anyone can insert strategic call responses"
ON public.strategic_call_responses FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.strategic_calls sc
    WHERE sc.id = call_id
      AND sc.status = 'active'
  )
);

-- 4) scheduling_settings: remove public-read; expose narrow RPCs
DROP POLICY IF EXISTS "Public can view scheduling settings for booking" ON public.scheduling_settings;

CREATE OR REPLACE FUNCTION public.get_public_scheduling_settings_by_slug(p_slug text)
RETURNS TABLE(
  id uuid, user_id uuid, slot_duration_minutes int, buffer_minutes int,
  working_days jsonb, working_hours_start time, working_hours_end time,
  booking_link_slug text, min_advance_value int, min_advance_unit text, max_advance_days int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.user_id, s.slot_duration_minutes, s.buffer_minutes,
         s.working_days, s.working_hours_start, s.working_hours_end,
         s.booking_link_slug, s.min_advance_value, s.min_advance_unit, s.max_advance_days
  FROM public.scheduling_settings s
  WHERE s.booking_link_slug = p_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_scheduling_settings_by_user(p_user_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, slot_duration_minutes int, buffer_minutes int,
  working_days jsonb, working_hours_start time, working_hours_end time,
  min_advance_value int, min_advance_unit text, max_advance_days int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.user_id, s.slot_duration_minutes, s.buffer_minutes,
         s.working_days, s.working_hours_start, s.working_hours_end,
         s.min_advance_value, s.min_advance_unit, s.max_advance_days
  FROM public.scheduling_settings s
  WHERE s.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_scheduling_settings_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_scheduling_settings_by_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_scheduling_settings_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_scheduling_settings_by_user(uuid) TO anon, authenticated;
