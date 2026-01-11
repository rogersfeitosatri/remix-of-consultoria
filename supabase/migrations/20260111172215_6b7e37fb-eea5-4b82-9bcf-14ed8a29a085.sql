-- Function to link appointment to the correct consultation schedule window
-- Called after an appointment is created via public booking
CREATE OR REPLACE FUNCTION public.link_appointment_to_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matching_schedule_id uuid;
  v_next_pending_schedule record;
BEGIN
  -- Only process for confirmed/scheduled appointments
  IF NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- First, try to find a schedule where the appointment date falls within the window
  SELECT id INTO v_matching_schedule_id
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status IN ('pending', 'sent', 'link_sent')
    AND NEW.appointment_date >= date_trunc('week', scheduled_date::timestamp)::date
    AND NEW.appointment_date <= (date_trunc('week', scheduled_date::timestamp) + interval '6 days')::date
  ORDER BY scheduled_date ASC
  LIMIT 1;

  -- If no matching window found, get the first pending/sent schedule
  IF v_matching_schedule_id IS NULL THEN
    SELECT id INTO v_matching_schedule_id
    FROM public.consultation_schedules
    WHERE client_id = NEW.client_id
      AND status IN ('pending', 'sent', 'link_sent')
    ORDER BY scheduled_date ASC
    LIMIT 1;
  END IF;

  -- Update the matching schedule if found
  IF v_matching_schedule_id IS NOT NULL THEN
    UPDATE public.consultation_schedules
    SET 
      status = 'scheduled',
      scheduled_time = NEW.appointment_time::text,
      updated_at = now()
    WHERE id = v_matching_schedule_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run after appointment insert
DROP TRIGGER IF EXISTS trigger_link_appointment_to_schedule ON public.appointments;

CREATE TRIGGER trigger_link_appointment_to_schedule
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.link_appointment_to_schedule();

-- Also create trigger for updates (e.g., when status changes to confirmed)
DROP TRIGGER IF EXISTS trigger_link_appointment_to_schedule_update ON public.appointments;

CREATE TRIGGER trigger_link_appointment_to_schedule_update
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (NEW.status IN ('scheduled', 'confirmed') AND OLD.status NOT IN ('scheduled', 'confirmed'))
EXECUTE FUNCTION public.link_appointment_to_schedule();