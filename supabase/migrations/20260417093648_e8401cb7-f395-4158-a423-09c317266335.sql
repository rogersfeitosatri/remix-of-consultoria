ALTER TABLE public.scheduled_checkins DROP CONSTRAINT IF EXISTS scheduled_checkins_status_check;

ALTER TABLE public.scheduled_checkins ADD CONSTRAINT scheduled_checkins_status_check 
CHECK (status IN ('pending', 'sent', 'skipped', 'completed', 'cancelled'));