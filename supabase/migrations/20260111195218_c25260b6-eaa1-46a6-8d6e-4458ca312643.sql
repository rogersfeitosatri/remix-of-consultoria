
-- Add target_race field to athlete_profiles for storing the athlete's goal race
ALTER TABLE public.athlete_profiles 
ADD COLUMN IF NOT EXISTS target_race TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.athlete_profiles.target_race IS 'Prova alvo do atleta (ex: Maratona de São Paulo 2026)';
