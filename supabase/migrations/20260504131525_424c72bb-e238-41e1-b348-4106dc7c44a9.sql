UPDATE public.consultation_schedules
SET send_link_date = (scheduled_date + ((1 - EXTRACT(DOW FROM scheduled_date)::int + 7) % 7) * INTERVAL '1 day')::date,
    updated_at = now()
WHERE status = 'pending'
  AND send_link_date IS DISTINCT FROM (scheduled_date + ((1 - EXTRACT(DOW FROM scheduled_date)::int + 7) % 7) * INTERVAL '1 day')::date;