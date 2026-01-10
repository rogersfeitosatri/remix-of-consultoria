-- Fix create_public_booking_appointment to be compatible with appointments.appointment_date (DATE)
-- and avoid DATE=TEXT comparisons.
CREATE OR REPLACE FUNCTION public.create_public_booking_appointment(p_token text, p_date text, p_time text)
 RETURNS TABLE(appointment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx record;
  v_admin_user_id uuid;
  v_client_id uuid;
  v_time time;
  v_date date;
  v_day_of_week int;
  v_duration int;
  v_existing uuid;
BEGIN
  -- Basic validation
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Parse date
  BEGIN
    v_date := p_date::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Data inválida';
  END;

  IF v_date < current_date THEN
    RAISE EXCEPTION 'Data inválida';
  END IF;

  BEGIN
    v_time := p_time::time;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Horário inválido';
  END;

  -- Fetch booking context (validates active + expiry)
  SELECT * INTO v_ctx
  FROM public.get_public_booking_context(p_token)
  LIMIT 1;

  IF v_ctx IS NULL OR v_ctx.admin_user_id IS NULL OR v_ctx.client_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  v_admin_user_id := v_ctx.admin_user_id;
  v_client_id := v_ctx.client_id;

  -- Determine duration: prefer availability_rules for that weekday; else scheduling_settings; else 60
  v_day_of_week := extract(dow from v_date)::int;

  SELECT ar.slot_minutes
    INTO v_duration
  FROM public.availability_rules ar
  WHERE ar.user_id = v_admin_user_id
    AND ar.is_enabled = true
    AND ar.day_of_week = v_day_of_week
  ORDER BY ar.start_time
  LIMIT 1;

  IF v_duration IS NULL THEN
    SELECT ss.slot_duration_minutes
      INTO v_duration
    FROM public.scheduling_settings ss
    WHERE ss.user_id = v_admin_user_id
    LIMIT 1;
  END IF;

  IF v_duration IS NULL THEN
    v_duration := 60;
  END IF;

  -- Prevent exact slot conflicts
  SELECT a.id
    INTO v_existing
  FROM public.appointments a
  WHERE a.user_id = v_admin_user_id
    AND a.appointment_date = v_date
    AND to_char(a.appointment_time, 'HH24:MI') = to_char(v_time, 'HH24:MI')
    AND a.status IN ('scheduled', 'confirmed')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  -- Insert appointment
  INSERT INTO public.appointments (
    client_id,
    user_id,
    appointment_date,
    appointment_time,
    duration_minutes,
    status,
    timezone
  ) VALUES (
    v_client_id,
    v_admin_user_id,
    v_date,
    v_time,
    v_duration,
    'confirmed',
    'America/Fortaleza'
  )
  RETURNING id INTO appointment_id;

  -- Increment booking link usage
  UPDATE public.booking_links
  SET usage_count = coalesce(usage_count, 0) + 1
  WHERE token = p_token;

  RETURN NEXT;
END;
$function$;