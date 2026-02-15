
-- Add new columns to np_periodization_weeks for phase-based periodization
ALTER TABLE public.np_periodization_weeks
  ADD COLUMN IF NOT EXISTS cho_gkg numeric,
  ADD COLUMN IF NOT EXISTS protein_gkg numeric,
  ADD COLUMN IF NOT EXISTS fat_gkg numeric,
  ADD COLUMN IF NOT EXISTS daily_strategies jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intra_cho_gh numeric,
  ADD COLUMN IF NOT EXISTS pre_training_cho_gkg numeric,
  ADD COLUMN IF NOT EXISTS caffeine_mg_kg numeric,
  ADD COLUMN IF NOT EXISTS energy_availability numeric,
  ADD COLUMN IF NOT EXISTS gi_tolerance_rating integer,
  ADD COLUMN IF NOT EXISTS carb_loading_type text,
  ADD COLUMN IF NOT EXISTS race_simulation_notes text,
  ADD COLUMN IF NOT EXISTS micro_adjustment_notes text,
  ADD COLUMN IF NOT EXISTS is_adjustment_week boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_objectives text,
  ADD COLUMN IF NOT EXISTS sodium_strategy text,
  ADD COLUMN IF NOT EXISTS hydration_strategy text;

-- Add columns to np_consultations for manual age/sex override
ALTER TABLE public.np_consultations
  ADD COLUMN IF NOT EXISTS manual_age integer,
  ADD COLUMN IF NOT EXISTS manual_gender text;
