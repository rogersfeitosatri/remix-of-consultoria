
-- ============================================================
-- SECURITY FIXES
-- ============================================================

-- 1) APPOINTMENTS: drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view appointments for availability check" ON public.appointments;

-- Provide a minimal-data RPC for public availability check
CREATE OR REPLACE FUNCTION public.get_public_appointment_slots(
  p_user_id uuid,
  p_from_date date DEFAULT CURRENT_DATE,
  p_to_date date DEFAULT NULL
)
RETURNS TABLE (
  appointment_date date,
  appointment_time time without time zone,
  duration_minutes integer,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.appointment_date, a.appointment_time, a.duration_minutes, a.status
  FROM public.appointments a
  WHERE a.user_id = p_user_id
    AND a.status IN ('scheduled', 'confirmed')
    AND a.appointment_date >= COALESCE(p_from_date, CURRENT_DATE)
    AND (p_to_date IS NULL OR a.appointment_date <= p_to_date);
$$;

REVOKE ALL ON FUNCTION public.get_public_appointment_slots(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_appointment_slots(uuid, date, date) TO anon, authenticated;


-- 2) SCHEDULING_BLOCKS: drop public-everything SELECT, expose only minimal columns via RPC
DROP POLICY IF EXISTS "Anyone can view scheduling blocks by user" ON public.scheduling_blocks;

CREATE OR REPLACE FUNCTION public.get_public_scheduling_blocks(
  p_user_id uuid,
  p_from_date date DEFAULT CURRENT_DATE,
  p_to_date date DEFAULT NULL
)
RETURNS TABLE (
  block_date date,
  block_type text,
  start_time time without time zone,
  end_time time without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.block_date, b.block_type, b.start_time, b.end_time
  FROM public.scheduling_blocks b
  WHERE b.user_id = p_user_id
    AND b.block_date >= COALESCE(p_from_date, CURRENT_DATE)
    AND (p_to_date IS NULL OR b.block_date <= p_to_date);
$$;

REVOKE ALL ON FUNCTION public.get_public_scheduling_blocks(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_scheduling_blocks(uuid, date, date) TO anon, authenticated;


-- 3) BOOKING_LINKS: stop bulk enumeration of active tokens
-- Public lookup is already done through SECURITY DEFINER RPCs (get_public_booking_context,
-- validate_booking_email_v2). Authenticated admin/athlete reads are covered by other policies.
DROP POLICY IF EXISTS "Public can view active booking links by token" ON public.booking_links;


-- 4) CALL_BOOKINGS: drop public SELECT exposing all PII
-- Public flow uses RPCs (create_call_booking, get_call_available_slots) only.
DROP POLICY IF EXISTS "Public reads bookings" ON public.call_bookings;


-- 5) DIET_APP_CONFIG: remove overly broad SELECT
DROP POLICY IF EXISTS "Authenticated users can view diet app config" ON public.diet_app_config;


-- 6) WHATSAPP_MESSAGE_LOGS: require authentication for inserts
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.whatsapp_message_logs;
CREATE POLICY "Users can insert their own logs"
ON public.whatsapp_message_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);


-- 7) STORAGE athlete-attachments: enforce ownership via clients table
-- File path convention: "<client_id>/<timestamp>.<ext>"
DROP POLICY IF EXISTS "Admins can upload athlete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view athlete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete athlete attachments" ON storage.objects;

CREATE POLICY "Owners can view athlete attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR c.athlete_user_id = auth.uid())
  )
);

CREATE POLICY "Owners can upload athlete attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete athlete attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'athlete-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.user_id = auth.uid()
  )
);
