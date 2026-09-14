-- A pending reservation is not a sent message. Preserve all existing timestamps.
ALTER TABLE public.checkin_dispatches ALTER COLUMN sent_at DROP NOT NULL;
ALTER TABLE public.checkin_dispatches ALTER COLUMN sent_at DROP DEFAULT;
