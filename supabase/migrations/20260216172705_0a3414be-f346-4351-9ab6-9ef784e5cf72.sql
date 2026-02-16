
-- Fix: update_consultation_journey should disable rule when all consultations are completed
CREATE OR REPLACE FUNCTION public.update_consultation_journey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_record RECORD;
  v_cadence_weeks integer;
  v_next_send_date date;
  v_new_completed integer;
  v_should_enable boolean;
BEGIN
  IF NEW.status IN ('confirmed', 'scheduled') THEN
    SELECT c.consultation_frequency, c.end_date, c.has_consultations, c.consultation_count
    INTO v_client_record
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    v_cadence_weeks := CASE 
      WHEN v_client_record.consultation_frequency = '6_weeks' THEN 6
      WHEN v_client_record.consultation_frequency = '4_weeks' THEN 4
      ELSE 4
    END;
    
    v_next_send_date := public.calculate_next_booking_send_date(
      (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      v_cadence_weeks
    );

    -- Calculate what the new consultations_completed will be
    v_new_completed := COALESCE(
      (SELECT consultations_completed FROM public.consultation_schedule_rules WHERE client_id = NEW.client_id),
      0
    ) + 1;

    -- Determine if we should keep the rule enabled
    -- Disable if consultation_count is set and we've reached/exceeded it
    v_should_enable := (
      v_client_record.consultation_count IS NULL 
      OR v_client_record.consultation_count = 0 
      OR v_new_completed < v_client_record.consultation_count
    );
    
    INSERT INTO public.consultation_schedule_rules (
      client_id,
      cadence_weeks,
      is_enabled,
      first_consultation_at,
      last_appointment_at,
      next_link_send_date,
      consultations_completed
    ) VALUES (
      NEW.client_id,
      v_cadence_weeks,
      v_should_enable,
      (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      CASE 
        WHEN v_should_enable AND v_client_record.end_date > (CURRENT_DATE + (v_cadence_weeks * INTERVAL '1 week')::interval)
        THEN v_next_send_date
        ELSE NULL
      END,
      1
    )
    ON CONFLICT (client_id) DO UPDATE SET
      cadence_weeks = v_cadence_weeks,
      is_enabled = v_should_enable,
      last_appointment_at = (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      next_link_send_date = CASE 
        WHEN v_should_enable AND v_client_record.end_date > (CURRENT_DATE + (v_cadence_weeks * INTERVAL '1 week')::interval)
        THEN v_next_send_date
        ELSE NULL
      END,
      consultations_completed = COALESCE(consultation_schedule_rules.consultations_completed, 0) + 1,
      updated_at = now();
    
    IF v_client_record.has_consultations = true THEN
      UPDATE public.clients
      SET first_consultation_date = COALESCE(first_consultation_date, NEW.appointment_date)
      WHERE id = NEW.client_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
