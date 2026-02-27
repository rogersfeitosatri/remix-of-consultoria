
ALTER TABLE public.journey_week_sessions
  ADD COLUMN is_long_run boolean DEFAULT false,
  ADD COLUMN carb_loading_enabled boolean DEFAULT false,
  ADD COLUMN carb_loading_hours integer DEFAULT null;

COMMENT ON COLUMN public.journey_week_sessions.is_long_run IS 'Whether this session is a long run (longão)';
COMMENT ON COLUMN public.journey_week_sessions.carb_loading_enabled IS 'Whether carb-loading should be applied before this session';
COMMENT ON COLUMN public.journey_week_sessions.carb_loading_hours IS 'Hours before session to start carb-loading (24 or 48)';
