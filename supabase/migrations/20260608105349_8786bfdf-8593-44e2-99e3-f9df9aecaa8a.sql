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
      AND (
        _client_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = _client_id AND c.user_id = cf.user_id
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Anyone can submit responses" ON public.checkin_responses;

CREATE POLICY "Anyone can submit responses"
ON public.checkin_responses
FOR INSERT
WITH CHECK (public.can_submit_checkin_response(form_id, client_id));