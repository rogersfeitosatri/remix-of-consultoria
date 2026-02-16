
-- Fix: get_pending_booking_invites should exclude athletes who completed all consultations
CREATE OR REPLACE FUNCTION public.get_pending_booking_invites()
RETURNS TABLE(
  client_id uuid,
  client_name text,
  client_phone text,
  admin_user_id uuid,
  cadence_weeks integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    csr.client_id,
    c.name AS client_name,
    c.phone AS client_phone,
    c.user_id AS admin_user_id,
    csr.cadence_weeks
  FROM public.consultation_schedule_rules csr
  JOIN public.clients c ON c.id = csr.client_id
  WHERE csr.is_enabled = true
    AND csr.next_link_send_date IS NOT NULL
    AND csr.next_link_send_date <= CURRENT_DATE
    AND (
      csr.last_link_sent_at IS NULL 
      OR csr.last_link_sent_at::date < CURRENT_DATE
    )
    AND c.is_active = true
    AND (c.has_consultations = true OR c.has_agenda_access = true)
    -- Verifica se está dentro do período do plano
    AND c.end_date > CURRENT_DATE + (csr.cadence_weeks * INTERVAL '1 week')
    -- NEW: Skip athletes who already completed all their consultations
    AND (
      c.consultation_count IS NULL 
      OR c.consultation_count = 0 
      OR COALESCE(csr.consultations_completed, 0) < c.consultation_count
    );
$$;
