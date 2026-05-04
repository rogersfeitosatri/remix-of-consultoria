-- Corrige cálculo de send_link_date em todas as funções de pipeline.
-- Regra: send_link_date = primeira segunda-feira >= (consulta_anterior + cadência_semanas)
-- Helper inline: monday_on_or_after(d) = d + ((8 - dow(d)) % 7) dias quando d não é segunda; 0 se já é segunda
-- dow: 0=dom,1=seg,...,6=sab
-- offset_to_next_monday(d) = ((1 - dow(d) + 7) % 7)

-- 1) bootstrap_pipeline_from_first_appointment
CREATE OR REPLACE FUNCTION public.bootstrap_pipeline_from_first_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
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

  v_cadence_weeks := CASE
    WHEN v_client.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN v_client.consultation_frequency IN ('monthly', '4_weeks') THEN 4
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

  -- 1ª consulta: send_date = primeira segunda >= a própria data (não usado para envio mas mantido por consistência)
  v_send_date := (NEW.appointment_date + ((1 - EXTRACT(DOW FROM NEW.appointment_date)::int + 7) % 7) * INTERVAL '1 day')::date;

  INSERT INTO public.consultation_schedules (
    client_id, user_id, scheduled_date, scheduled_time, send_link_date,
    status, appointment_id
  ) VALUES (
    NEW.client_id, v_client.user_id, NEW.appointment_date, NEW.appointment_time,
    v_send_date, 'scheduled', NEW.id
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
    v_next_date := (v_prev_date + (v_cadence_weeks * INTERVAL '1 week'))::date;

    EXIT WHEN v_client.end_date IS NOT NULL AND v_next_date > v_client.end_date;

    -- Primeira segunda-feira >= (consulta anterior + N semanas)
    -- offset = (1 - dow + 7) % 7  → 0 se já é segunda, senão dias até próxima segunda
    v_send_date := (v_next_date + ((1 - EXTRACT(DOW FROM v_next_date)::int + 7) % 7) * INTERVAL '1 day')::date;

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

-- 2) sync_pipeline_on_plan_change
CREATE OR REPLACE FUNCTION public.sync_pipeline_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cadence_weeks integer;
  v_last_completed_date date;
  v_anchor_date date;
  v_next_date date;
  v_send_date date;
  v_remaining integer;
  v_completed_count integer;
  v_total integer;
  v_i integer;
BEGIN
  IF (OLD.consultation_frequency IS DISTINCT FROM NEW.consultation_frequency)
     OR (OLD.consultation_count IS DISTINCT FROM NEW.consultation_count)
     OR (OLD.has_consultations IS DISTINCT FROM NEW.has_consultations)
     OR (OLD.end_date IS DISTINCT FROM NEW.end_date)
  THEN
    IF NEW.has_consultations IS NOT TRUE THEN
      DELETE FROM public.consultation_schedules
      WHERE client_id = NEW.id AND status = 'pending';
      RETURN NEW;
    END IF;

    v_cadence_weeks := CASE
      WHEN NEW.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
      ELSE 4
    END;

    SELECT COUNT(*) INTO v_completed_count
    FROM public.consultation_schedules
    WHERE client_id = NEW.id AND status IN ('completed', 'scheduled');

    SELECT MAX(scheduled_date) INTO v_last_completed_date
    FROM public.consultation_schedules
    WHERE client_id = NEW.id AND status IN ('completed', 'scheduled');

    v_anchor_date := COALESCE(v_last_completed_date, NEW.start_date::date);

    DELETE FROM public.consultation_schedules
    WHERE client_id = NEW.id AND status = 'pending';

    v_total := COALESCE(NEW.consultation_count, 0);
    IF v_total = 0 THEN
      v_remaining := 52;
    ELSE
      v_remaining := v_total - v_completed_count;
    END IF;

    IF v_remaining <= 0 THEN
      RETURN NEW;
    END IF;

    v_next_date := v_anchor_date;
    v_i := 0;
    WHILE v_i < v_remaining LOOP
      v_next_date := (v_next_date + (v_cadence_weeks * INTERVAL '1 week'))::date;
      EXIT WHEN v_next_date > NEW.end_date::date;

      -- Primeira segunda-feira >= data da próxima consulta
      v_send_date := (v_next_date + ((1 - EXTRACT(DOW FROM v_next_date)::int + 7) % 7) * INTERVAL '1 day')::date;

      INSERT INTO public.consultation_schedules (
        client_id, user_id, scheduled_date, send_link_date, status
      ) VALUES (
        NEW.id, NEW.user_id, v_next_date, v_send_date, 'pending'
      );

      v_i := v_i + 1;
    END LOOP;

    IF v_total > 0 THEN
      UPDATE public.clients
      SET remaining_consultations = GREATEST(v_total - v_completed_count, 0)
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) preview_consultation_pipeline
CREATE OR REPLACE FUNCTION public.preview_consultation_pipeline(p_start_date date, p_consultation_count integer, p_consultation_frequency text, p_end_date date DEFAULT NULL::date)
RETURNS TABLE(sequence_index integer, scheduled_date date, send_link_date date, exceeds_end_date boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cadence_weeks int;
  v_current date;
  v_send date;
  v_i int := 1;
  v_max int;
BEGIN
  IF p_start_date IS NULL THEN RETURN; END IF;

  v_cadence_weeks := CASE
    WHEN p_consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN p_consultation_frequency IN ('monthly', '4_weeks') THEN 4
    WHEN p_consultation_frequency = 'weekly' THEN 1
    WHEN p_consultation_frequency = 'biweekly' THEN 2
    ELSE 4
  END;

  IF p_consultation_count IS NULL OR p_consultation_count = 0 THEN
    v_max := 24;
  ELSE
    v_max := p_consultation_count;
  END IF;

  v_current := p_start_date;

  WHILE v_i <= v_max LOOP
    IF v_i > 1 THEN
      v_current := (v_current + (v_cadence_weeks * INTERVAL '1 week'))::date;
    END IF;

    IF (p_consultation_count IS NULL OR p_consultation_count = 0)
       AND p_end_date IS NOT NULL
       AND v_current > p_end_date THEN
      EXIT;
    END IF;

    -- Primeira segunda-feira >= data da consulta
    v_send := (v_current + ((1 - EXTRACT(DOW FROM v_current)::int + 7) % 7) * INTERVAL '1 day')::date;

    sequence_index := v_i;
    scheduled_date := v_current;
    send_link_date := v_send;
    exceeds_end_date := (p_end_date IS NOT NULL AND v_current > p_end_date);
    RETURN NEXT;

    v_i := v_i + 1;
  END LOOP;
END;
$function$;