
-- Table to persist evolution AI analyses
CREATE TABLE public.evolution_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  analysis JSONB NOT NULL,
  has_target_race BOOLEAN NOT NULL DEFAULT false,
  target_race_name TEXT,
  target_race_deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only keep the latest analysis per client (unique constraint)
CREATE UNIQUE INDEX idx_evolution_analyses_client ON public.evolution_analyses(client_id);

ALTER TABLE public.evolution_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evolution analyses for their clients"
ON public.evolution_analyses FOR SELECT
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert evolution analyses for their clients"
ON public.evolution_analyses FOR INSERT
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update evolution analyses for their clients"
ON public.evolution_analyses FOR UPDATE
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

CREATE TRIGGER update_evolution_analyses_updated_at
BEFORE UPDATE ON public.evolution_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
