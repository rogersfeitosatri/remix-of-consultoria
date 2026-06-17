
-- List upcoming appointments for client of token
CREATE OR REPLACE FUNCTION public.get_public_client_upcoming_appointments(p_token text)
RETURNS TABLE(
  appointment_id uuid,
  appointment_date date,
  appointment_time time,
  duration_minutes int,
  status text,
  google_meet_link text,
  hours_until numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_now_local timestamp;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token) LIMIT 1;
  IF v_ctx IS NULL OR v_ctx.client_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  v_now_local := (now() AT TIME ZONE 'America/Fortaleza');

  RETURN QUERY
  SELECT
    a.id,
    a.appointment_date,
    a.appointment_time,
    a.duration_minutes,
    a.status,
    a.google_meet_link,
    EXTRACT(EPOCH FROM ((a.appointment_date::timestamp + a.appointment_time) - v_now_local)) / 3600.0
  FROM public.appointments a
  WHERE a.client_id = v_ctx.client_id
    AND a.status IN ('scheduled', 'confirmed')
    AND (a.appointment_date::timestamp + a.appointment_time) > v_now_local
  ORDER BY a.appointment_date, a.appointment_time
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_upcoming_appointments(text) TO anon, authenticated;

-- Reschedule an existing appointment (>6h rule)
CREATE OR REPLACE FUNCTION public.reschedule_public_booking_appointment(
  p_token text,
  p_appointment_id uuid,
  p_date text,
  p_time text
)
RETURNS TABLE(appointment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_admin_user_id uuid;
  v_client_id uuid;
  v_appt record;
  v_now_local timestamp;
  v_hours_until numeric;
  v_date date;
  v_time time;
  v_day_of_week int;
  v_duration int;
  v_existing uuid;
  v_block_count int;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN RAISE EXCEPTION 'Token inválido'; END IF;
  IF p_appointment_id IS NULL THEN RAISE EXCEPTION 'Consulta inválida'; END IF;

  BEGIN v_date := p_date::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Data inválida'; END;
  BEGIN v_time := p_time::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Horário inválido'; END;
  IF v_date < current_date THEN RAISE EXCEPTION 'Data inválida'; END IF;

  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token) LIMIT 1;
  IF v_ctx IS NULL OR v_ctx.admin_user_id IS NULL OR v_ctx.client_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;
  v_admin_user_id := v_ctx.admin_user_id;
  v_client_id := v_ctx.client_id;

  SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.client_id, a.user_id, a.google_calendar_event_id
  INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appt IS NULL THEN RAISE EXCEPTION 'Consulta não encontrada'; END IF;
  IF v_appt.client_id <> v_client_id THEN RAISE EXCEPTION 'Consulta não pertence a este atleta'; END IF;
  IF v_appt.status NOT IN ('scheduled', 'confirmed') THEN RAISE EXCEPTION 'Consulta não pode ser remarcada'; END IF;

  v_now_local := (now() AT TIME ZONE 'America/Fortaleza');
  v_hours_until := EXTRACT(EPOCH FROM ((v_appt.appointment_date::timestamp + v_appt.appointment_time) - v_now_local)) / 3600.0;
  IF v_hours_until < 6 THEN
    RAISE EXCEPTION 'Não é possível remarcar com menos de 6 horas de antecedência.';
  END IF;

  -- block guards
  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id AND block_date = v_date AND block_type = 'full_day';
  IF v_block_count > 0 THEN RAISE EXCEPTION 'Data indisponível (bloqueada pelo profissional).'; END IF;

  SELECT COUNT(*) INTO v_block_count
  FROM public.scheduling_blocks
  WHERE user_id = v_admin_user_id AND block_date = v_date AND block_type = 'time_range'
    AND start_time IS NOT NULL AND end_time IS NOT NULL
    AND v_time >= start_time AND v_time < end_time;
  IF v_block_count > 0 THEN RAISE EXCEPTION 'Horário indisponível (bloqueado pelo profissional).'; END IF;

  v_day_of_week := extract(dow from v_date)::int;
  SELECT ar.slot_minutes INTO v_duration
  FROM public.availability_rules ar
  WHERE ar.user_id = v_admin_user_id AND ar.is_enabled = true AND ar.day_of_week = v_day_of_week
  ORDER BY ar.start_time LIMIT 1;
  IF v_duration IS NULL THEN
    SELECT ss.slot_duration_minutes INTO v_duration
    FROM public.scheduling_settings ss WHERE ss.user_id = v_admin_user_id LIMIT 1;
  END IF;
  IF v_duration IS NULL THEN v_duration := 60; END IF;

  -- conflict check (exclude self)
  SELECT a.id INTO v_existing
  FROM public.appointments a
  WHERE a.user_id = v_admin_user_id
    AND a.appointment_date = v_date
    AND to_char(a.appointment_time, 'HH24:MI') = to_char(v_time, 'HH24:MI')
    AND a.status IN ('scheduled', 'confirmed')
    AND a.id <> p_appointment_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  UPDATE public.appointments
  SET appointment_date = v_date,
      appointment_time = v_time,
      duration_minutes = v_duration,
      status = 'confirmed',
      google_calendar_event_id = NULL,
      google_meet_link = NULL,
      updated_at = now()
  WHERE id = p_appointment_id;

  appointment_id := p_appointment_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_public_booking_appointment(text, uuid, text, text) TO anon, authenticated;

-- Mark appointment as completed when athlete cannot attend
CREATE OR REPLACE FUNCTION public.cancel_public_booking_as_completed(
  p_token text,
  p_appointment_id uuid
)
RETURNS TABLE(appointment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_appt record;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN RAISE EXCEPTION 'Token inválido'; END IF;
  IF p_appointment_id IS NULL THEN RAISE EXCEPTION 'Consulta inválida'; END IF;

  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token) LIMIT 1;
  IF v_ctx IS NULL OR v_ctx.client_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  SELECT a.id, a.client_id, a.status INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appt IS NULL THEN RAISE EXCEPTION 'Consulta não encontrada'; END IF;
  IF v_appt.client_id <> v_ctx.client_id THEN RAISE EXCEPTION 'Consulta não pertence a este atleta'; END IF;
  IF v_appt.status NOT IN ('scheduled', 'confirmed') THEN RAISE EXCEPTION 'Consulta já finalizada'; END IF;

  UPDATE public.appointments
  SET status = 'completed',
      notes = COALESCE(notes || E'\n', '') || '[Atleta informou que não poderia comparecer - marcada como realizada via link público em ' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') || ']',
      updated_at = now()
  WHERE id = p_appointment_id;

  appointment_id := p_appointment_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_public_booking_as_completed(text, uuid) TO anon, authenticated;
