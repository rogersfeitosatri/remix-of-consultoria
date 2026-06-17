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

  SELECT id INTO v_schedule_id
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status IN ('pending', 'sent', 'scheduled')
    AND appointment_id IS NULL
  ORDER BY ABS((scheduled_date - NEW.appointment_date)) ASC
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