-- Helper: Monday on-or-before (d - 1 day), i.e. the Monday of the week leading up to the consultation
CREATE OR REPLACE FUNCTION public.booking_send_date(p_scheduled_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ((p_scheduled_date - 1) - (((EXTRACT(DOW FROM (p_scheduled_date - 1))::int + 6) % 7)))::date
$$;

GRANT EXECUTE ON FUNCTION public.booking_send_date(date) TO authenticated, service_role;

-- 1) Corrige o trigger de bootstrap: link deve ser enviado ANTES da consulta
CREATE OR REPLACE FUNCTION public.bootstrap_pipeline_from_first_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_use_months boolean;
  v_cadence_weeks integer;
  v_total integer;
  v_remaining integer;
  v_existing_pending integer;
  v_existing_completed integer;
  v_prev_date date;
  v_next_date date;
  v_send_date date;
  v_i integer;
  v_first_schedule_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT id, user_id, has_consultations, consultation_frequency, consultation_count,
         end_date, first_consultation_date
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client IS NULL OR v_client.has_consultations IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_client.first_consultation_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_use_months := (v_client.consultation_frequency = 'monthly');
  v_cadence_weeks := CASE
    WHEN v_client.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN v_client.consultation_frequency = '4_weeks' THEN 4
    WHEN v_client.consultation_frequency = 'weekly' THEN 1
    WHEN v_client.consultation_frequency = 'biweekly' THEN 2
    ELSE 4
  END;

  UPDATE public.clients
  SET first_consultation_date = NEW.appointment_date,
      updated_at = now()
  WHERE id = NEW.client_id;

  SELECT COUNT(*) FILTER (WHERE status IN ('completed', 'scheduled')),
         COUNT(*) FILTER (WHERE status = 'pending')
    INTO v_existing_completed, v_existing_pending
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id;

  DELETE FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status = 'pending';

  INSERT INTO public.consultation_schedules (
    client_id, user_id, scheduled_date, scheduled_time, send_link_date,
    status, appointment_id
  ) VALUES (
    NEW.client_id, v_client.user_id, NEW.appointment_date, NEW.appointment_time,
    NEW.appointment_date, 'scheduled', NEW.id
  )
  RETURNING id INTO v_first_schedule_id;

  v_total := COALESCE(v_client.consultation_count, 0);
  IF v_total <= 0 THEN
    v_remaining := 24;
  ELSE
    v_remaining := v_total - 1 - v_existing_completed;
  END IF;

  IF v_remaining <= 0 THEN
    RETURN NEW;
  END IF;

  v_prev_date := NEW.appointment_date;
  v_i := 0;
  WHILE v_i < v_remaining LOOP
    IF v_use_months THEN
      v_next_date := (NEW.appointment_date + ((v_i + 1) * INTERVAL '1 month'))::date;
    ELSE
      v_next_date := (v_prev_date + (v_cadence_weeks * INTERVAL '1 week'))::date;
    END IF;

    EXIT WHEN v_client.end_date IS NOT NULL AND v_next_date > v_client.end_date;

    v_send_date := public.booking_send_date(v_next_date);
    IF v_send_date < CURRENT_DATE THEN
      v_send_date := LEAST(CURRENT_DATE, v_next_date);
    END IF;

    INSERT INTO public.consultation_schedules (
      client_id, user_id, scheduled_date, send_link_date, status
    ) VALUES (
      NEW.client_id, v_client.user_id, v_next_date, v_send_date, 'pending'
    );

    v_prev_date := v_next_date;
    v_i := v_i + 1;
  END LOOP;

  IF v_total > 0 THEN
    UPDATE public.clients
    SET remaining_consultations = GREATEST(v_total - v_existing_completed - 1, 0)
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Mesma regra na conclusão manual da 1a consulta
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

    v_send_date := public.booking_send_date(v_next_date);
    IF v_send_date < CURRENT_DATE THEN
      v_send_date := LEAST(CURRENT_DATE, v_next_date);
    END IF;

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

-- 3) BACKFILL: consultas futuras pendentes cujo link seria enviado no dia ou depois da consulta
UPDATE public.consultation_schedules cs
   SET send_link_date = GREATEST(public.booking_send_date(cs.scheduled_date), CURRENT_DATE),
       updated_at = now()
 WHERE cs.status IN ('pending', 'sent', 'link_sent')
   AND cs.link_sent_at IS NULL
   AND cs.scheduled_date > CURRENT_DATE
   AND cs.send_link_date >= cs.scheduled_date;