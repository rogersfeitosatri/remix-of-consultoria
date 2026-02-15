
-- Knowledge Base for Periodiza Agent
CREATE TABLE public.periodiza_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'nota do admin',
  source_reference TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  collection TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.periodiza_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge base"
ON public.periodiza_knowledge_base FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin Instructions for Periodiza Agent
CREATE TABLE public.periodiza_admin_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  preset_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.periodiza_admin_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own instructions"
ON public.periodiza_admin_instructions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI-generated periodization suggestions (versioned)
CREATE TABLE public.periodiza_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.np_consultations(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  suggestion_type TEXT NOT NULL DEFAULT 'full',
  phase_plan JSONB,
  monthly_adjustments JSONB,
  taper_protocol JSONB,
  nutritionist_notes JSONB,
  human_readable TEXT,
  manual_edits JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.periodiza_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own suggestions"
ON public.periodiza_suggestions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add micro_adjustment_notes to np_periodization_weeks if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'np_periodization_weeks' AND column_name = 'micro_adjustment_notes') THEN
    ALTER TABLE public.np_periodization_weeks ADD COLUMN micro_adjustment_notes TEXT;
  END IF;
END $$;
