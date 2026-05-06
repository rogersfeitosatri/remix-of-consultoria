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
  v_block_count int;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  BEGIN v_date := p_date::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Data inválida'; END;
  IF v_date < current_date THEN RAISE EXCEPTION 'Data inválida'; END IF;
  BEGIN v_time := p_time::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Horário inválido'; END;

  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token) LIMIT 1;
  IF v_ctx IS NULL OR v_ctx.admin_user_id IS NULL OR v_ctx.client_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  v_admin_user_id := v_ctx.admin_user_id;
  v_client_id := v_ctx.client_id;

  -- Block guard: full-day
  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id
    AND block_date = v_date
    AND block_type = 'full_day';
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Data indisponível (bloqueada pelo profissional).';
  END IF;

  -- Block guard: time-range
  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id
    AND block_date = v_date
    AND block_type = 'time_range'
    AND start_time IS NOT NULL
    AND end_time IS NOT NULL
    AND v_time >= start_time
    AND v_time < end_time;
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Horário indisponível (bloqueado pelo profissional).';
  END IF;

  v_day_of_week := extract(dow from v_date)::int;

  SELECT ar.slot_minutes INTO v_duration
  FROM public.availability_rules ar
  WHERE ar.user_id = v_admin_user_id
    AND ar.is_enabled = true
    AND ar.day_of_week = v_day_of_week
  ORDER BY ar.start_time LIMIT 1;

  IF v_duration IS NULL THEN
    SELECT ss.slot_duration_minutes INTO v_duration
    FROM public.scheduling_settings ss
    WHERE ss.user_id = v_admin_user_id LIMIT 1;
  END IF;
  IF v_duration IS NULL THEN v_duration := 60; END IF;

  SELECT a.id INTO v_existing
  FROM public.appointments a
  WHERE a.user_id = v_admin_user_id
    AND a.appointment_date = v_date
    AND to_char(a.appointment_time, 'HH24:MI') = to_char(v_time, 'HH24:MI')
    AND a.status IN ('scheduled', 'confirmed')
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  INSERT INTO public.appointments (
    client_id, user_id, appointment_date, appointment_time,
    duration_minutes, status, timezone
  ) VALUES (
    v_client_id, v_admin_user_id, v_date, v_time,
    v_duration, 'confirmed', 'America/Fortaleza'
  )
  RETURNING id INTO appointment_id;

  UPDATE public.booking_links
  SET usage_count = coalesce(usage_count, 0) + 1
  WHERE token = p_token;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_lead_appointment(p_slug text, p_date text, p_time text, p_name text, p_email text, p_phone text DEFAULT NULL::text)
 RETURNS TABLE(appointment_id uuid, client_id uuid, is_new_lead boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings RECORD;
  v_admin_user_id uuid;
  v_date date;
  v_time time;
  v_duration int;
  v_existing_client_id uuid;
  v_client_id uuid;
  v_appointment_id uuid;
  v_is_new boolean := false;
  v_email text;
  v_name text;
  v_phone text;
  v_conflict_count int;
  v_block_count int;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RAISE EXCEPTION 'Link inválido.'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  IF p_email IS NULL OR p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;

  v_email := lower(trim(p_email));
  v_name := trim(p_name);
  v_phone := NULLIF(trim(coalesce(p_phone,'')), '');

  BEGIN v_date := p_date::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Data inválida.'; END;
  BEGIN v_time := p_time::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Horário inválido.'; END;
  IF v_date < current_date THEN RAISE EXCEPTION 'Não é possível agendar para datas passadas.'; END IF;

  SELECT user_id, slot_duration_minutes INTO v_settings
  FROM public.scheduling_settings WHERE booking_link_slug = p_slug LIMIT 1;
  IF v_settings IS NULL OR v_settings.user_id IS NULL THEN RAISE EXCEPTION 'Link de agendamento não encontrado.'; END IF;

  v_admin_user_id := v_settings.user_id;
  v_duration := COALESCE(v_settings.slot_duration_minutes, 60);

  -- Block guard: full-day
  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id AND block_date = v_date AND block_type = 'full_day';
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Data indisponível (bloqueada pelo profissional).';
  END IF;

  -- Block guard: time-range
  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id
    AND block_date = v_date
    AND block_type = 'time_range'
    AND start_time IS NOT NULL AND end_time IS NOT NULL
    AND v_time >= start_time AND v_time < end_time;
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Horário indisponível (bloqueado pelo profissional).';
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.user_id = v_admin_user_id
    AND a.appointment_date = v_date
    AND to_char(a.appointment_time, 'HH24:MI') = to_char(v_time, 'HH24:MI')
    AND a.status IN ('scheduled', 'confirmed');
  IF v_conflict_count > 0 THEN RAISE EXCEPTION 'Horário indisponível. Outra pessoa acabou de reservar este horário.'; END IF;

  SELECT id INTO v_existing_client_id
  FROM public.clients
  WHERE user_id = v_admin_user_id AND lower(trim(email)) = v_email LIMIT 1;

  IF v_existing_client_id IS NOT NULL THEN
    v_client_id := v_existing_client_id;
    v_is_new := false;
    IF v_phone IS NOT NULL THEN
      UPDATE public.clients SET phone = COALESCE(NULLIF(trim(phone), ''), v_phone) WHERE id = v_client_id;
    END IF;
  ELSE
    INSERT INTO public.clients (
      user_id, name, email, phone, service_type, plan_type, has_checkin,
      start_date, end_date, monthly_value, is_active, eligible_for_booking, is_frozen,
      registration_source, athlete_status
    ) VALUES (
      v_admin_user_id, v_name, v_email, v_phone, 'nutrition', 'consultoria', false,
      current_date, current_date, 0, false, false, false, 'public_booking', 'lead'
    ) RETURNING id INTO v_client_id;
    v_is_new := true;
  END IF;

  INSERT INTO public.appointments (
    user_id, client_id, appointment_date, appointment_time, duration_minutes,
    status, timezone, notes
  ) VALUES (
    v_admin_user_id, v_client_id, v_date, v_time, v_duration,
    'confirmed', 'America/Fortaleza',
    CASE WHEN v_is_new THEN 'Agendamento público (lead novo via /agendar)' ELSE 'Agendamento público via /agendar' END
  ) RETURNING id INTO v_appointment_id;

  appointment_id := v_appointment_id;
  client_id := v_client_id;
  is_new_lead := v_is_new;
  RETURN NEXT;
END;
$function$;