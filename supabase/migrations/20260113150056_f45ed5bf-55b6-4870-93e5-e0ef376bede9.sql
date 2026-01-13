-- Add anamnese_completed field to athlete_profiles if not exists
ALTER TABLE public.athlete_profiles 
ADD COLUMN IF NOT EXISTS anamnese_completed boolean DEFAULT false;

-- Update existing records: if anamnese_submitted_at is not null, set anamnese_completed = true
UPDATE public.athlete_profiles 
SET anamnese_completed = true 
WHERE anamnese_submitted_at IS NOT NULL;