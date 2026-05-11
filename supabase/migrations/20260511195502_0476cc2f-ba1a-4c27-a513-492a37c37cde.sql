CREATE OR REPLACE FUNCTION public.resolve_public_checkin_form(p_form_id uuid)
RETURNS TABLE(id uuid, title text, description text, is_active boolean, redirected boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_qcount int;
  v_fallback record;
BEGIN
  -- Try requested form
  SELECT f.user_id INTO v_owner FROM public.checkin_forms f WHERE f.id = p_form_id;
  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_qcount FROM public.checkin_questions WHERE form_id = p_form_id;

  -- If requested form is active AND has questions, return it
  IF v_qcount > 0 AND EXISTS (SELECT 1 FROM public.checkin_forms WHERE id = p_form_id AND is_active = true) THEN
    RETURN QUERY
      SELECT f.id, f.title, f.description, f.is_active, false
      FROM public.checkin_forms f WHERE f.id = p_form_id;
    RETURN;
  END IF;

  -- Otherwise, fall back to the owner's first active form with questions
  SELECT f.id, f.title, f.description, f.is_active INTO v_fallback
  FROM public.checkin_forms f
  WHERE f.user_id = v_owner
    AND f.is_active = true
    AND EXISTS (SELECT 1 FROM public.checkin_questions q WHERE q.form_id = f.id)
  ORDER BY f.created_at ASC
  LIMIT 1;

  IF v_fallback.id IS NOT NULL THEN
    RETURN QUERY SELECT v_fallback.id, v_fallback.title, v_fallback.description, v_fallback.is_active, true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_public_checkin_form(uuid) TO anon, authenticated;