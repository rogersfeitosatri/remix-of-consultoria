
-- Add AI analysis column to metabolic_screening_responses
ALTER TABLE public.metabolic_screening_responses 
ADD COLUMN IF NOT EXISTS ai_analysis jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz DEFAULT NULL;
