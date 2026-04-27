-- 1) Allow 'public_booking' as a valid registration_source
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_registration_source;
ALTER TABLE public.clients ADD CONSTRAINT check_registration_source
  CHECK (registration_source = ANY (ARRAY['manual'::text, 'kiwify'::text, 'anamnese_auto'::text, 'public_booking'::text]));

-- 2) RPC: public lead booking via /agendar/{slug}
CREATE OR REPLACE FUNCTION public.create_public_lead_appointment(
  p_slug text,
  p_date text,
  p_time text,
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS TABLE(appointment_id uuid, client_id uuid, is_new_lead boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Basic input validation
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Informe seu nome completo.';
  END IF;
  IF p_email IS NULL OR p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  v_email := lower(trim(p_email));
  v_name := trim(p_name);
  v_phone := NULLIF(trim(coalesce(p_phone,'')), '');

  -- Parse date / time
  BEGIN
    v_date := p_date::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Data inválida.';
  END;
  BEGIN
    v_time := p_time::time;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Horário inválido.';
  END;

  IF v_date < current_date THEN
    RAISE EXCEPTION 'Não é possível agendar para datas passadas.';
  END IF;

  -- Resolve admin via slug
  SELECT user_id, slot_duration_minutes
    INTO v_settings
  FROM public.scheduling_settings
  WHERE booking_link_slug = p_slug
  LIMIT 1;

  IF v_settings IS NULL OR v_settings.user_id IS NULL THEN
    RAISE EXCEPTION 'Link de agendamento não encontrado.';
  END IF;

  v_admin_user_id := v_settings.user_id;
  v_duration := COALESCE(v_settings.slot_duration_minutes, 60);

  -- Conflict guard (exact slot)
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.user_id = v_admin_user_id
    AND a.appointment_date = v_date
    AND to_char(a.appointment_time, 'HH24:MI') = to_char(v_time, 'HH24:MI')
    AND a.status IN ('scheduled', 'confirmed');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Outra pessoa acabou de reservar este horário.';
  END IF;

  -- Try to match existing athlete by email under the same admin
  SELECT id INTO v_existing_client_id
  FROM public.clients
  WHERE user_id = v_admin_user_id
    AND lower(trim(email)) = v_email
  LIMIT 1;

  IF v_existing_client_id IS NOT NULL THEN
    v_client_id := v_existing_client_id;
    v_is_new := false;
    -- Optionally update phone if previously empty
    IF v_phone IS NOT NULL THEN
      UPDATE public.clients
      SET phone = COALESCE(NULLIF(trim(phone), ''), v_phone)
      WHERE id = v_client_id;
    END IF;
  ELSE
    -- Create lightweight lead
    INSERT INTO public.clients (
      user_id, name, email, phone,
      service_type, plan_type, has_checkin,
      start_date, end_date, monthly_value,
      is_active, eligible_for_booking, is_frozen,
      registration_source, athlete_status
    ) VALUES (
      v_admin_user_id, v_name, v_email, v_phone,
      'nutrition', 'consultoria', false,
      current_date, current_date, 0,
      false, false, false,
      'public_booking', 'lead'
    )
    RETURNING id INTO v_client_id;
    v_is_new := true;
  END IF;

  -- Create the appointment
  INSERT INTO public.appointments (
    user_id, client_id,
    appointment_date, appointment_time, duration_minutes,
    status, timezone, notes
  ) VALUES (
    v_admin_user_id, v_client_id,
    v_date, v_time, v_duration,
    'confirmed', 'America/Fortaleza',
    CASE WHEN v_is_new THEN 'Agendamento público (lead novo via /agendar)' ELSE 'Agendamento público via /agendar' END
  )
  RETURNING id INTO v_appointment_id;

  appointment_id := v_appointment_id;
  client_id := v_client_id;
  is_new_lead := v_is_new;
  RETURN NEXT;
END;
$$;

-- 3) Allow anonymous (anon) and authenticated to call the RPC
GRANT EXECUTE ON FUNCTION public.create_public_lead_appointment(text, text, text, text, text, text) TO anon, authenticated;