
-- Table to store metabolic screening responses per athlete per date
CREATE TABLE public.metabolic_screening_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  screening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responses JSONB NOT NULL DEFAULT '{}',
  -- Pre-calculated scores per category for fast querying
  score_assimilacao INTEGER DEFAULT 0,
  score_defesa_reparo INTEGER DEFAULT 0,
  score_energia INTEGER DEFAULT 0,
  score_biotransformacao INTEGER DEFAULT 0,
  score_transporte INTEGER DEFAULT 0,
  score_comunicacao INTEGER DEFAULT 0,
  score_integridade_estrutural INTEGER DEFAULT 0,
  score_mental_emocional INTEGER DEFAULT 0,
  score_total INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.metabolic_screening_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin can manage their athletes' data
CREATE POLICY "Admins can view metabolic screenings"
ON public.metabolic_screening_responses
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can insert metabolic screenings"
ON public.metabolic_screening_responses
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update metabolic screenings"
ON public.metabolic_screening_responses
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can delete metabolic screenings"
ON public.metabolic_screening_responses
FOR DELETE
USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_metabolic_screening_client ON public.metabolic_screening_responses(client_id, screening_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_metabolic_screening_updated_at
BEFORE UPDATE ON public.metabolic_screening_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
