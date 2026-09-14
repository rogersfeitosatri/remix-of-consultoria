-- Legacy manual callers still rely on this default. New reservations explicitly send NULL.
ALTER TABLE public.checkin_dispatches ALTER COLUMN sent_at SET DEFAULT now();
