CREATE OR REPLACE FUNCTION public.complete_first_consultation(p_schedule_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sch RECORD;
  v_client RECORD;
  v_appt_id uuid;
  v_use_months boolean;
  v_cadence_weeks integer;
  v_total integer;
  v_remaining integer;
  v_done integer;
  v_prev_date date;
  v_next_date date;
  v_send_date date;
  v_i integer := 0;
  v_created integer := 0;
BEGIN
  SELECT * INTO v_sch FROM public.consultation_schedules WHERE id = p_schedule_id;
  IF v_sch IS NULL THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;
  IF v_sch.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta consulta';
  END IF;

  SELECT id, user_id, consultation_frequency, consultation_count, end_date, first_consultation_date
    INTO v_client FROM public.clients WHERE id = v_sch.client_id;

  -- 1) appointment retroativo
  v_appt_id := v_sch.appointment_id;
  IF v_appt_id IS NULL THEN
    INSERT INTO public.appointments (
      client_id, user_id, appointment_date, appointment_time, duration_minutes,
      status, timezone, created_by, notes_admin, consultation_schedule_id
    ) VALUES (
      v_sch.client_id, v_sch.user_id, v_sch.scheduled_date,
      COALESCE(v_sch.scheduled_time, '09:00:00'::time), 60,
      'completed', 'America/Fortaleza', auth.uid(),
      'Marcada como realizada manualmente via auditoria.', v_sch.id
    ) RETURNING id INTO v_appt_id;
  ELSE
    UPDATE public.appointments SET status = 'completed' WHERE id = v_appt_id;
  END IF;

  UPDATE public.consultation_schedules
     SET status = 'completed', confirmed_at = now(), appointment_id = v_appt_id, updated_at = now()
   WHERE id = p_schedule_id;

  UPDATE public.clients
     SET first_consultation_date = COALESCE(first_consultation_date, v_sch.scheduled_date),
         updated_at = now()
   WHERE id = v_sch.client_id;

  -- 2) regenerar consultas futuras
  v_use_months := (v_client.consultation_frequency = 'monthly');
  v_cadence_weeks := CASE
    WHEN v_client.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN v_client.consultation_frequency = '4_weeks' THEN 4
    WHEN v_client.consultation_frequency = 'weekly' THEN 1
    WHEN v_client.consultation_frequency = 'biweekly' THEN 2
    ELSE 4
  END;

  DELETE FROM public.consultation_schedules
   WHERE client_id = v_sch.client_id
     AND id <> p_schedule_id
     AND status IN ('pending', 'sent', 'link_sent')
     AND scheduled_date > v_sch.scheduled_date;

  SELECT COUNT(*) INTO v_done
    FROM public.consultation_schedules
   WHERE client_id = v_sch.client_id
     AND status IN ('completed', 'scheduled', 'confirmed');

  v_total := COALESCE(v_client.consultation_count, 0);
  IF v_total <= 0 THEN
    v_remaining := 11;
  ELSE
    v_remaining := GREATEST(v_total - v_done, 0);
  END IF;

  v_prev_date := v_sch.scheduled_date;
  WHILE v_i < v_remaining LOOP
    IF v_use_months THEN
      v_next_date := (v_sch.scheduled_date + ((v_i + 1) * INTERVAL '1 month'))::date;
    ELSE
      v_next_date := (v_prev_date + (v_cadence_weeks * INTERVAL '1 week'))::date;
    END IF;

    EXIT WHEN v_client.end_date IS NOT NULL AND v_next_date > v_client.end_date;

    v_send_date := (v_next_date - INTERVAL '7 day')::date;

    INSERT INTO public.consultation_schedules (
      client_id, user_id, scheduled_date, send_link_date, status
    ) VALUES (
      v_sch.client_id, v_sch.user_id, v_next_date, v_send_date, 'pending'
    );

    v_prev_date := v_next_date;
    v_i := v_i + 1;
    v_created := v_created + 1;
  END LOOP;

  IF v_total > 0 THEN
    UPDATE public.clients
       SET remaining_consultations = GREATEST(v_total - v_done, 0)
     WHERE id = v_sch.client_id;
  END IF;

  RETURN jsonb_build_object('appointment_id', v_appt_id, 'created', v_created);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_first_consultation(uuid) TO authenticated;