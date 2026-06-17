CREATE OR REPLACE FUNCTION public.can_submit_checkin_response(_form_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checkin_forms cf
    WHERE cf.id = _form_id
      AND cf.is_active = true
      AND _client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id AND c.user_id = cf.user_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.checkin_dispatches d
        LEFT JOIN public.clients c2 ON c2.id = _client_id
        WHERE d.client_id = _client_id
          AND d.checkin_form_id = _form_id
          AND d.status = 'sent'
          AND d.sent_at IS NOT NULL
          AND d.sent_at > now() - (COALESCE(c2.checkin_response_window_hours, 36) || ' hours')::interval
      )
  );
$$;