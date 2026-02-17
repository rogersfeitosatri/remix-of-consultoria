
ALTER TABLE public.journey_day_dynamics
  ADD COLUMN cho_gkg numeric DEFAULT NULL,
  ADD COLUMN morning_cho_pct integer DEFAULT NULL,
  ADD COLUMN afternoon_cho_pct integer DEFAULT NULL,
  ADD COLUMN night_cho_pct integer DEFAULT NULL,
  ADD COLUMN distribution_rationale text DEFAULT NULL;
