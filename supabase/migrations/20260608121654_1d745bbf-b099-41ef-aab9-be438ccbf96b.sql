
-- Fix: do not generate consultation pipeline until athlete actually books the first appointment.
CREATE OR REPLACE FUNCTION public.sync_pipeline_on_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_use_months boolean;
  v_cadence_weeks integer;
  v_last_completed_date date;
  v_anchor_date date;
  v_next_date date;
  v_send_date date;
  v_remaining integer;
  v_completed_count integer;
  v_total integer;
  v_i integer;
  v_has_appointment boolean;
BEGIN
  IF (OLD.consultation_frequency IS DISTINCT FROM NEW.consultation_frequency)
     OR (OLD.consultation_count IS DISTINCT FROM NEW.consultation_count)
     OR (OLD.has_consultations IS DISTINCT FROM NEW.has_consultations)
     OR (OLD.end_date IS DISTINCT FROM NEW.end_date)
     OR (OLD.start_date IS DISTINCT FROM NEW.start_date)
  THEN
    -- Cancel pending/sent schedules from old plan period
    UPDATE public.consultation_schedules
    SET status = 'cancelled', updated_at = now()
    WHERE client_id = NEW.id
      AND status IN ('pending', 'sent')
      AND scheduled_date < NEW.start_date::date;

    IF NEW.has_consultations IS NOT TRUE THEN
      DELETE FROM public.consultation_schedules
      WHERE client_id = NEW.id AND status = 'pending';
      RETURN NEW;
    END IF;

    -- GATE: Only project pipeline if athlete already has at least one real
    -- appointment (scheduled/confirmed/completed). Otherwise, wait for the
    -- first booking — bootstrap_pipeline_from_first_appointment will generate
    -- the full pipeline at the right cadence anchored on the booked date.
    SELECT EXISTS(
      SELECT 1 FROM public.appointments
      WHERE client_id = NEW.id
        AND status IN ('scheduled', 'confirmed', 'completed')
    ) INTO v_has_appointment;

    IF NOT v_has_appointment THEN
      -- Clear any leftover pendings and reset first_consultation_date so
      -- bootstrap will fire once the athlete books the first appointment.
      DELETE FROM public.consultation_schedules
      WHERE client_id = NEW.id AND status IN ('pending', 'sent');

      IF NEW.first_consultation_date IS NOT NULL THEN
        UPDATE public.clients
        SET first_consultation_date = NULL
        WHERE id = NEW.id;
      END IF;

      RETURN NEW;
    END IF;

    v_use_months := (NEW.consultation_frequency = 'monthly');
    v_cadence_weeks := CASE
      WHEN NEW.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
      ELSE 4
    END;

    SELECT COUNT(*) INTO v_completed_count
    FROM public.consultation_schedules
    WHERE client_id = NEW.id
      AND status IN ('completed', 'scheduled')
      AND scheduled_date >= NEW.start_date::date;

    SELECT MAX(scheduled_date) INTO v_last_completed_date
    FROM public.consultation_schedules
    WHERE client_id = NEW.id
      AND status IN ('completed', 'scheduled')
      AND scheduled_date >= NEW.start_date::date;

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
      IF v_use_months THEN
        v_next_date := (v_anchor_date + ((v_i + 1) * INTERVAL '1 month'))::date;
      ELSE
        v_next_date := (v_next_date + (v_cadence_weeks * INTERVAL '1 week'))::date;
      END IF;
      EXIT WHEN v_next_date > NEW.end_date::date;

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

-- Clean up Miguel Araujo (no appointment yet, but 8 pendings were projected):
DELETE FROM public.consultation_schedules
WHERE client_id = '27a63ddf-3474-46c1-8275-39a18d6b158a'
  AND status IN ('pending', 'sent');

UPDATE public.clients
SET first_consultation_date = NULL
WHERE id = '27a63ddf-3474-46c1-8275-39a18d6b158a';
