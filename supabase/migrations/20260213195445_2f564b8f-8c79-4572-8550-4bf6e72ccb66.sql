-- Add target_race_date to np_consultations
ALTER TABLE public.np_consultations ADD COLUMN IF NOT EXISTS target_race_date date;

-- Add phase_name to np_periodization_weeks
ALTER TABLE public.np_periodization_weeks ADD COLUMN IF NOT EXISTS phase_name text;