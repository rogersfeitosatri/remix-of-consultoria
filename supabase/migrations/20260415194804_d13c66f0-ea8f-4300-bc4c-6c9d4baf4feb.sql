
-- 1) Trigger: sync consultation_schedules when appointment status/date changes
CREATE OR REPLACE FUNCTION public.sync_schedule_on_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Case 1: Appointment cancelled → revert linked schedule to 'pending'
  IF NEW.status IN ('cancelled', 'no_show') AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    UPDATE public.consultation_schedules
    SET status = 'pending',
        appointment_id = NULL,
        scheduled_time = NULL,
        confirmed_at = NULL,
        updated_at = now()
    WHERE appointment_id = NEW.id;
  END IF;

  -- Case 2: Appointment completed → mark schedule as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.consultation_schedules
    SET status = 'completed',
        confirmed_at = COALESCE(confirmed_at, now()),
        updated_at = now()
    WHERE appointment_id = NEW.id;
  END IF;

  -- Case 3: Appointment date changed (rescheduled) → update schedule dates
  IF NEW.appointment_date != OLD.appointment_date AND NEW.status IN ('scheduled', 'confirmed') THEN
    UPDATE public.consultation_schedules
    SET scheduled_date = NEW.appointment_date,
        scheduled_time = NEW.appointment_time,
        updated_at = now()
    WHERE appointment_id = NEW.id;
  END IF;

  -- Case 4: Appointment time changed → update schedule time
  IF NEW.appointment_time != OLD.appointment_time AND NEW.appointment_date = OLD.appointment_date 
     AND NEW.status IN ('scheduled', 'confirmed') THEN
    UPDATE public.consultation_schedules
    SET scheduled_time = NEW.appointment_time,
        updated_at = now()
    WHERE appointment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS trigger_sync_schedule_on_appointment_change ON public.appointments;
CREATE TRIGGER trigger_sync_schedule_on_appointment_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_schedule_on_appointment_change();


-- 2) Trigger: when admin changes client plan (frequency/count), recalculate future pipeline
CREATE OR REPLACE FUNCTION public.sync_pipeline_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cadence_weeks integer;
  v_last_completed_date date;
  v_last_scheduled_date date;
  v_anchor_date date;
  v_next_date date;
  v_remaining integer;
  v_completed_count integer;
  v_total integer;
  v_i integer;
BEGIN
  -- Only act when consultation-related fields change
  IF (OLD.consultation_frequency IS DISTINCT FROM NEW.consultation_frequency)
     OR (OLD.consultation_count IS DISTINCT FROM NEW.consultation_count)
     OR (OLD.has_consultations IS DISTINCT FROM NEW.has_consultations)
     OR (OLD.end_date IS DISTINCT FROM NEW.end_date)
  THEN
    -- If consultations disabled, delete future pending schedules
    IF NEW.has_consultations IS NOT TRUE THEN
      DELETE FROM public.consultation_schedules
      WHERE client_id = NEW.id
        AND status = 'pending';
      RETURN NEW;
    END IF;

    -- Calculate cadence
    v_cadence_weeks := CASE 
      WHEN NEW.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
      ELSE 4
    END;

    -- Count completed consultations
    SELECT COUNT(*) INTO v_completed_count
    FROM public.consultation_schedules
    WHERE client_id = NEW.id
      AND status IN ('completed', 'scheduled');

    -- Find the anchor: last completed or scheduled date
    SELECT MAX(scheduled_date) INTO v_last_completed_date
    FROM public.consultation_schedules
    WHERE client_id = NEW.id
      AND status IN ('completed', 'scheduled');

    -- If no history, use start_date
    v_anchor_date := COALESCE(v_last_completed_date, NEW.start_date::date);

    -- Delete only future pending schedules (preserve completed/scheduled)
    DELETE FROM public.consultation_schedules
    WHERE client_id = NEW.id
      AND status = 'pending';

    -- Calculate how many future consultations to project
    v_total := COALESCE(NEW.consultation_count, 0);
    IF v_total = 0 THEN
      -- Unlimited: project up to end_date
      v_remaining := 52; -- max safety cap
    ELSE
      v_remaining := v_total - v_completed_count;
    END IF;

    IF v_remaining <= 0 THEN
      RETURN NEW;
    END IF;

    -- Project future dates
    v_next_date := v_anchor_date;
    v_i := 0;
    WHILE v_i < v_remaining LOOP
      v_next_date := (v_next_date + (v_cadence_weeks * INTERVAL '1 week'))::date;
      
      -- Stop if past end_date
      EXIT WHEN v_next_date > NEW.end_date::date;

      -- Calculate send_link_date (Monday of the week before)
      INSERT INTO public.consultation_schedules (
        client_id, user_id, scheduled_date, send_link_date, status
      ) VALUES (
        NEW.id,
        NEW.user_id,
        v_next_date,
        -- Monday of the previous week
        (v_next_date - ((EXTRACT(DOW FROM v_next_date)::int + 6) % 7 + 7) * INTERVAL '1 day')::date,
        'pending'
      );

      v_i := v_i + 1;
    END LOOP;

    -- Update remaining_consultations
    IF v_total > 0 THEN
      UPDATE public.clients
      SET remaining_consultations = GREATEST(v_total - v_completed_count, 0)
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_pipeline_on_plan_change ON public.clients;
CREATE TRIGGER trigger_sync_pipeline_on_plan_change
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pipeline_on_plan_change();


-- 3) Trigger: when a schedule is marked completed manually, update remaining_consultations
CREATE OR REPLACE FUNCTION public.sync_remaining_on_schedule_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total integer;
  v_done integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT consultation_count INTO v_total
    FROM public.clients
    WHERE id = NEW.client_id;

    IF v_total IS NOT NULL AND v_total > 0 THEN
      SELECT COUNT(*) INTO v_done
      FROM public.consultation_schedules
      WHERE client_id = NEW.client_id
        AND status = 'completed';

      UPDATE public.clients
      SET remaining_consultations = GREATEST(v_total - v_done, 0)
      WHERE id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_remaining_on_schedule_complete ON public.consultation_schedules;
CREATE TRIGGER trigger_sync_remaining_on_schedule_complete
  AFTER UPDATE ON public.consultation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_remaining_on_schedule_complete();
