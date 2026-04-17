ALTER TABLE public.scheduling_settings
  ADD COLUMN IF NOT EXISTS min_advance_value integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS min_advance_unit text NOT NULL DEFAULT 'hours',
  ADD COLUMN IF NOT EXISTS max_advance_days integer NOT NULL DEFAULT 60;

ALTER TABLE public.scheduling_settings
  DROP CONSTRAINT IF EXISTS scheduling_settings_min_advance_unit_check;
ALTER TABLE public.scheduling_settings
  ADD CONSTRAINT scheduling_settings_min_advance_unit_check
  CHECK (min_advance_unit IN ('hours', 'days'));