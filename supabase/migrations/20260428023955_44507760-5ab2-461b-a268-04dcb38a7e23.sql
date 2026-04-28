-- Tabela para persistir resumos de evolução gerados por IA
CREATE TABLE public.np_evolution_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  user_id UUID NOT NULL,
  race_id UUID,
  phase TEXT,
  weeks_to_race INTEGER,
  logs_analyzed INTEGER NOT NULL DEFAULT 0,
  summary_markdown TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_np_evolution_summaries_client ON public.np_evolution_summaries(client_id, created_at DESC);

ALTER TABLE public.np_evolution_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage own np_evolution_summaries"
ON public.np_evolution_summaries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);