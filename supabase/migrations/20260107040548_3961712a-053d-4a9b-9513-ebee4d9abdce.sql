-- Create table for AI analyses
CREATE TABLE public.ai_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  athlete_profile_id UUID REFERENCES public.athlete_profiles(id) ON DELETE SET NULL,
  diagnosis TEXT NOT NULL,
  energy_expenditure JSONB NOT NULL,
  caloric_deficit JSONB NOT NULL,
  macronutrients JSONB NOT NULL,
  alerts TEXT[],
  raw_response TEXT,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

-- Only admins can view AI analyses (athletes should NOT see this)
CREATE POLICY "Admins can view AI analyses for their clients"
ON public.ai_analyses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = ai_analyses.client_id
    AND c.user_id = auth.uid()
  )
);

-- Admins can insert analyses for their clients
CREATE POLICY "Admins can create AI analyses for their clients"
ON public.ai_analyses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = ai_analyses.client_id
    AND c.user_id = auth.uid()
  )
);

-- Admins can update analyses for their clients
CREATE POLICY "Admins can update AI analyses for their clients"
ON public.ai_analyses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = ai_analyses.client_id
    AND c.user_id = auth.uid()
  )
);

-- Admins can delete analyses for their clients
CREATE POLICY "Admins can delete AI analyses for their clients"
ON public.ai_analyses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = ai_analyses.client_id
    AND c.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_analyses_updated_at
BEFORE UPDATE ON public.ai_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();