
-- Add tracking columns to consultation_schedules
ALTER TABLE public.consultation_schedules 
  ADD COLUMN IF NOT EXISTS link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_status text,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id);

-- Add constraint for confirmation_status values
ALTER TABLE public.consultation_schedules 
  ADD CONSTRAINT consultation_schedules_confirmation_status_check 
  CHECK (confirmation_status IS NULL OR confirmation_status IN ('realizada', 'nao_realizada'));

-- Create index for appointment linkage
CREATE INDEX IF NOT EXISTS idx_consultation_schedules_appointment_id 
  ON public.consultation_schedules(appointment_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_consultation_schedules_status_date 
  ON public.consultation_schedules(status, scheduled_date);

-- Update the trigger to also set link_sent_at when status changes to 'sent' or 'link_sent'
CREATE OR REPLACE FUNCTION public.update_schedule_link_sent_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When status changes to sent/link_sent, record the timestamp
  IF NEW.status IN ('sent', 'link_sent') AND OLD.status NOT IN ('sent', 'link_sent') THEN
    NEW.link_sent_at = COALESCE(NEW.link_sent_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schedule_link_sent_at
  BEFORE UPDATE ON public.consultation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_link_sent_at();

-- Update link_appointment_to_schedule to also set appointment_id
CREATE OR REPLACE FUNCTION public.link_appointment_to_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matching_schedule_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Try to find a schedule where the appointment date falls within the window
  SELECT id INTO v_matching_schedule_id
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status IN ('pending', 'sent', 'link_sent')
    AND NEW.appointment_date >= date_trunc('week', scheduled_date::timestamp)::date
    AND NEW.appointment_date <= (date_trunc('week', scheduled_date::timestamp) + interval '13 days')::date
  ORDER BY scheduled_date ASC
  LIMIT 1;

  IF v_matching_schedule_id IS NULL THEN
    SELECT id INTO v_matching_schedule_id
    FROM public.consultation_schedules
    WHERE client_id = NEW.client_id
      AND status IN ('pending', 'sent', 'link_sent')
    ORDER BY scheduled_date ASC
    LIMIT 1;
  END IF;

  IF v_matching_schedule_id IS NOT NULL THEN
    UPDATE public.consultation_schedules
    SET 
      status = 'scheduled',
      scheduled_time = NEW.appointment_time,
      appointment_id = NEW.id,
      updated_at = now()
    WHERE id = v_matching_schedule_id;
  END IF;

  RETURN NEW;
END;
$$;
