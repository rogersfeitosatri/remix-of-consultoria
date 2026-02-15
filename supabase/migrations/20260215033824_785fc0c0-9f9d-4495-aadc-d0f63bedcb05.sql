
-- Add columns to periodiza_suggestions for the new block-based format
ALTER TABLE public.periodiza_suggestions 
  ADD COLUMN IF NOT EXISTS periodization_start_date date,
  ADD COLUMN IF NOT EXISTS plan_adjustment_type text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS blocks jsonb;

-- Add comment
COMMENT ON COLUMN public.periodiza_suggestions.plan_adjustment_type IS 'monthly (4 weeks) or 6_weeks';
COMMENT ON COLUMN public.periodiza_suggestions.blocks IS 'Array of periodization blocks with weekly tables';
