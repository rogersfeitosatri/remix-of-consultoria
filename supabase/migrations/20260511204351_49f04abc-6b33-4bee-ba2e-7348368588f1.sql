CREATE OR REPLACE FUNCTION public.resolve_public_checkin_form(p_form_id uuid)
RETURNS TABLE(id uuid, title text, description text, is_active boolean, redirected boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_requested_is_active boolean;
  v_requested_is_periodization boolean;
  v_qcount int;
  v_fallback record;
BEGIN
  SELECT f.user_id, f.is_active, COALESCE(f.is_periodization, false)
  INTO v_owner, v_requested_is_active, v_requested_is_periodization
  FROM public.checkin_forms f
  WHERE f.id = p_form_id;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_qcount
  FROM public.checkin_questions q
  WHERE q.form_id = p_form_id;

  -- Use the requested form only when it is an active standard nutritional form with questions.
  IF v_qcount > 0 AND v_requested_is_active = true AND v_requested_is_periodization = false THEN
    RETURN QUERY
      SELECT f.id, f.title, f.description, f.is_active, false
      FROM public.checkin_forms f
      WHERE f.id = p_form_id;
    RETURN;
  END IF;

  -- Otherwise, fall back to the owner's standard Check-in Nutricional with questions.
  SELECT f.id, f.title, f.description, f.is_active
  INTO v_fallback
  FROM public.checkin_forms f
  WHERE f.user_id = v_owner
    AND f.is_active = true
    AND COALESCE(f.is_periodization, false) = false
    AND EXISTS (
      SELECT 1
      FROM public.checkin_questions q
      WHERE q.form_id = f.id
    )
  ORDER BY
    CASE
      WHEN lower(f.title) IN ('check-in nutricional', 'checkin nutricional') THEN 0
      WHEN lower(f.title) LIKE '%nutricional%' THEN 1
      ELSE 2
    END,
    f.created_at ASC
  LIMIT 1;

  IF v_fallback.id IS NOT NULL THEN
    RETURN QUERY
      SELECT v_fallback.id, v_fallback.title, v_fallback.description, v_fallback.is_active, true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_public_checkin_form(uuid) TO anon, authenticated;