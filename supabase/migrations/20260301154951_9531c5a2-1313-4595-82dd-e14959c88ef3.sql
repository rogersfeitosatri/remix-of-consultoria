
ALTER TABLE public.call_bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT DEFAULT NULL;
