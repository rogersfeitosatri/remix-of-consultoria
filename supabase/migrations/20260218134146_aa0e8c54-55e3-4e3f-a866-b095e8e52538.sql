
-- Add duration_minutes to journey_week_sessions
ALTER TABLE public.journey_week_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- Add initial_cho_gkg to athlete_periodization for persisting the CHO input
ALTER TABLE public.athlete_periodization
  ADD COLUMN IF NOT EXISTS initial_cho_gkg numeric DEFAULT 4;
