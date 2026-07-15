ALTER TABLE public.anamnese_questions
  ADD COLUMN IF NOT EXISTS question_key TEXT,
  ADD COLUMN IF NOT EXISTS conditional_logic JSONB,
  ADD COLUMN IF NOT EXISTS config JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_anamnese_questions_form_key
  ON public.anamnese_questions(form_id, question_key)
  WHERE question_key IS NOT NULL;

ALTER TABLE public.anamnese_forms
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.anamnese_responses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS form_version INTEGER,
  ADD COLUMN IF NOT EXISTS internal_alerts JSONB,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

UPDATE public.anamnese_responses SET status = 'submitted' WHERE status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_anamnese_responses_one_draft
  ON public.anamnese_responses(form_id, client_id)
  WHERE status = 'in_progress' AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anamnese_responses_status
  ON public.anamnese_responses(status);

DROP TRIGGER IF EXISTS update_anamnese_responses_updated_at ON public.anamnese_responses;
CREATE TRIGGER update_anamnese_responses_updated_at
  BEFORE UPDATE ON public.anamnese_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Athletes can update their own anamnese responses" ON public.anamnese_responses;
CREATE POLICY "Athletes can update their own anamnese responses"
ON public.anamnese_responses
FOR UPDATE
USING (
  client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.athlete_user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.athlete_user_id = auth.uid()
  )
);