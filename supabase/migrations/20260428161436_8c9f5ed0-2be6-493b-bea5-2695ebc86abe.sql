DROP FUNCTION IF EXISTS public.get_np_checkin_context(text);

CREATE FUNCTION public.get_np_checkin_context(p_token text)
RETURNS TABLE(
  link_id uuid,
  client_id uuid,
  client_name text,
  admin_user_id uuid,
  race_name text,
  race_date date,
  checkin_form_id uuid,
  checkin_form_title text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    l.id AS link_id,
    l.client_id,
    c.name AS client_name,
    c.user_id AS admin_user_id,
    r.race_name,
    r.race_date,
    cf.id AS checkin_form_id,
    cf.title AS checkin_form_title
  FROM public.np_periodization_checkin_links l
  JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.np_athlete_races r ON r.client_id = l.client_id AND r.is_active = true
  LEFT JOIN LATERAL (
    SELECT cf2.id, cf2.title
    FROM public.athlete_checkin_schedules acs
    JOIN public.checkin_forms cf2 ON cf2.id = acs.checkin_form_id
    WHERE acs.client_id = l.client_id
      AND acs.is_active = true
      AND cf2.is_periodization = true
    ORDER BY acs.created_at ASC
    LIMIT 1
  ) cf ON true
  WHERE l.token = p_token
    AND l.active = true
    AND (l.expires_at IS NULL OR l.expires_at > now())
  LIMIT 1;
$function$;