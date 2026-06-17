
-- 1) Refatorar sync_pipeline_on_plan_change: cancelar schedules antigos + ancorar dentro do novo ciclo
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
BEGIN
  IF (OLD.consultation_frequency IS DISTINCT FROM NEW.consultation_frequency)
     OR (OLD.consultation_count IS DISTINCT FROM NEW.consultation_count)
     OR (OLD.has_consultations IS DISTINCT FROM NEW.has_consultations)
     OR (OLD.end_date IS DISTINCT FROM NEW.end_date)
     OR (OLD.start_date IS DISTINCT FROM NEW.start_date)
  THEN
    -- Cancelar schedules pendentes/enviados que ficaram do plano antigo
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

    v_use_months := (NEW.consultation_frequency = 'monthly');
    v_cadence_weeks := CASE
      WHEN NEW.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
      ELSE 4
    END;

    -- Ancorar apenas em schedules DENTRO do novo ciclo do plano
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

-- 2) Auto-vincular appointment_id ao schedule mais próximo quando appointment é criado
CREATE OR REPLACE FUNCTION public.link_appointment_to_consultation_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Já existe schedule explícito? marca como completed e linka
  IF NEW.consultation_schedule_id IS NOT NULL THEN
    UPDATE public.consultation_schedules
    SET appointment_id = NEW.id,
        status = CASE WHEN status IN ('pending','sent') THEN 'completed' ELSE status END,
        scheduled_date = NEW.appointment_date,
        scheduled_time = NEW.appointment_time,
        updated_at = now()
    WHERE id = NEW.consultation_schedule_id
      AND (appointment_id IS NULL OR appointment_id = NEW.id);
    RETURN NEW;
  END IF;

  -- Senão, procurar schedule pendente/sent mais próximo do client (sem appointment_id ainda)
  SELECT id INTO v_schedule_id
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status IN ('pending', 'sent', 'scheduled')
    AND appointment_id IS NULL
  ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_date - NEW.appointment_date))) ASC
  LIMIT 1;

  IF v_schedule_id IS NOT NULL THEN
    UPDATE public.consultation_schedules
    SET appointment_id = NEW.id,
        status = 'completed',
        scheduled_date = NEW.appointment_date,
        scheduled_time = NEW.appointment_time,
        updated_at = now()
    WHERE id = v_schedule_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_link_appointment_to_schedule ON public.appointments;
CREATE TRIGGER trg_link_appointment_to_schedule
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.link_appointment_to_consultation_schedule();
