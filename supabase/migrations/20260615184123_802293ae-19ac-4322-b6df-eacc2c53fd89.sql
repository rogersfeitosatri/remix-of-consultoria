CREATE OR REPLACE FUNCTION public.is_client_eligible_for_booking(_client_id uuid)
 RETURNS TABLE(eligible boolean, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_has_future_appt boolean;
  v_completed_count integer;
  v_period_start date;
BEGIN
  SELECT id, is_active, is_frozen, has_consultations, consultation_count, start_date, end_date
  INTO v_client FROM public.clients WHERE id = _client_id LIMIT 1;

  IF v_client IS NULL THEN RETURN QUERY SELECT false, 'client_not_found'::text; RETURN; END IF;
  IF v_client.is_frozen IS TRUE THEN RETURN QUERY SELECT false, 'client_frozen'::text; RETURN; END IF;
  IF v_client.is_active IS NOT TRUE THEN RETURN QUERY SELECT false, 'client_inactive'::text; RETURN; END IF;
  IF v_client.has_consultations IS NOT TRUE THEN RETURN QUERY SELECT false, 'no_consultations_in_plan'::text; RETURN; END IF;
  IF v_client.end_date IS NOT NULL AND v_client.end_date < CURRENT_DATE THEN RETURN QUERY SELECT false, 'plan_expired'::text; RETURN; END IF;

  SELECT EXISTS(SELECT 1 FROM public.appointments
    WHERE client_id = _client_id AND status IN ('scheduled','confirmed') AND appointment_date >= CURRENT_DATE
  ) INTO v_has_future_appt;
  IF v_has_future_appt THEN RETURN QUERY SELECT false, 'already_scheduled'::text; RETURN; END IF;

  IF v_client.consultation_count IS NOT NULL AND v_client.consultation_count > 0 THEN
    -- Determinar início do período do plano atual:
    -- usa a data mais recente entre client.start_date e o start_date da última renovação em client_plan_history
    SELECT GREATEST(
      COALESCE(v_client.start_date, '1900-01-01'::date),
      COALESCE((
        SELECT MAX(start_date::date)
        FROM public.client_plan_history
        WHERE client_id = _client_id
      ), '1900-01-01'::date)
    ) INTO v_period_start;

    SELECT COUNT(*) INTO v_completed_count
    FROM public.consultation_schedules
    WHERE client_id = _client_id
      AND status = 'completed'
      AND (v_period_start IS NULL OR scheduled_date >= v_period_start);

    IF v_completed_count >= v_client.consultation_count THEN
      RETURN QUERY SELECT false, 'consultations_exhausted'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, 'eligible'::text;
END;
$function$;