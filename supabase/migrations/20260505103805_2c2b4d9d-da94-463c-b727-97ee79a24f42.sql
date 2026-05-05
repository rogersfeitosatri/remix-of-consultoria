-- Clean up target_race fields polluted with full paragraphs (food strategy text, etc.)
-- Rule: target_race should be a short race name. Anything with newlines or > 80 chars is invalid.
UPDATE public.athlete_profiles
SET target_race = NULL
WHERE target_race IS NOT NULL
  AND (length(target_race) > 80 OR target_race ~ E'\n' OR target_race ~ '\r');