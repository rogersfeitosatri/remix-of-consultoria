-- Fix type mismatch when writing consultation_schedules.scheduled_time
-- Root cause: link_appointment_to_schedule was assigning NEW.appointment_time::text (text) into a time column.
-- Solution: assign the time value directly (time) to keep types consistent.

CREATE OR REPLACE FUNCTION public.link_appointment_to_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      scheduled_time = NEW.appointment_time, -- <-- keep as time (no ::text)
      updated_at = now()
    WHERE id = v_matching_schedule_id;
  END IF;

  RETURN NEW;
END;
$$;