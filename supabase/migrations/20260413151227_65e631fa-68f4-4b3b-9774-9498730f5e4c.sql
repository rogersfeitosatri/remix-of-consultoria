
-- Fix all athletes with six_weeks frequency but wrong cadence of 4
UPDATE public.consultation_schedule_rules csr
SET cadence_weeks = 6,
    next_link_send_date = CASE 
      WHEN csr.is_enabled AND csr.last_appointment_at IS NOT NULL 
      THEN (
        SELECT d FROM (
          SELECT generate_series(
            (csr.last_appointment_at + interval '6 weeks')::date,
            (csr.last_appointment_at + interval '6 weeks' + interval '6 days')::date,
            interval '1 day'
          )::date AS d
        ) sub WHERE EXTRACT(DOW FROM d) = 1 LIMIT 1
      )
      ELSE csr.next_link_send_date
    END,
    updated_at = now()
FROM public.clients c
WHERE c.id = csr.client_id
  AND c.consultation_frequency = 'six_weeks'
  AND csr.cadence_weeks = 4;
