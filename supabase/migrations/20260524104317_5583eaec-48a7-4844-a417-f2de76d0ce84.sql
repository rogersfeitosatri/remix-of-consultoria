-- Normalize all pending scheduled_checkins to fall strictly on Mondays.
-- Any non-Monday pending date is shifted forward to the next Monday so no
-- check-in is ever dispatched on Sun/Tue/Wed/Thu/Fri/Sat.
UPDATE public.scheduled_checkins
SET scheduled_send_date = (
  scheduled_send_date
  + ((8 - EXTRACT(DOW FROM scheduled_send_date)::int) % 7) * INTERVAL '1 day'
)::date
WHERE status = 'pending'
  AND sent_at IS NULL
  AND EXTRACT(DOW FROM scheduled_send_date) <> 1;