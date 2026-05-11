
ALTER TABLE public.scheduled_checkins
  DROP CONSTRAINT IF EXISTS scheduled_checkins_status_check;

ALTER TABLE public.scheduled_checkins
  ADD CONSTRAINT scheduled_checkins_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'skipped'::text, 'completed'::text, 'cancelled'::text, 'overdue'::text]));
