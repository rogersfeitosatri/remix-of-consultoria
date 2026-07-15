-- ANAMNESE COMPLETA — Fase 1 (fundação): estende o motor de anamnese dinâmica
-- existente (anamnese_forms / anamnese_questions / anamnese_responses) SEM
-- duplicar estruturas. Tudo aditivo e compatível com os formulários atuais.
--
-- Adiciona:
--  * question_key / conditional_logic / config em anamnese_questions
--    (chave estável p/ lógica condicional e normalização; config por tipo)
--  * version em anamnese_forms (versão do formulário)
--  * status/rascunho/revisão/alertas em anamnese_responses
--  * política RLS de UPDATE para o atleta salvar o próprio rascunho

-- ─────────────── anamnese_questions ───────────────
ALTER TABLE public.anamnese_questions
  ADD COLUMN IF NOT EXISTS question_key TEXT,
  ADD COLUMN IF NOT EXISTS conditional_logic JSONB,
  ADD COLUMN IF NOT EXISTS config JSONB;

-- chave única por formulário (quando informada) — usada por condicional/normalização
CREATE UNIQUE INDEX IF NOT EXISTS idx_anamnese_questions_form_key
  ON public.anamnese_questions(form_id, question_key)
  WHERE question_key IS NOT NULL;

-- ─────────────── anamnese_forms ───────────────
ALTER TABLE public.anamnese_forms
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ─────────────── anamnese_responses ───────────────
-- Ciclo de vida: in_progress (rascunho) → submitted → reviewed → archived.
ALTER TABLE public.anamnese_responses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS form_version INTEGER,
  ADD COLUMN IF NOT EXISTS internal_alerts JSONB,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- registros já existentes viram "submitted" (default cobre novos)
UPDATE public.anamnese_responses SET status = 'submitted' WHERE status IS NULL;

-- só pode haver UM rascunho por (form, client) — o autosave faz upsert nesse par
CREATE UNIQUE INDEX IF NOT EXISTS idx_anamnese_responses_one_draft
  ON public.anamnese_responses(form_id, client_id)
  WHERE status = 'in_progress' AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anamnese_responses_status
  ON public.anamnese_responses(status);

-- mantém updated_at em dia
DROP TRIGGER IF EXISTS update_anamnese_responses_updated_at ON public.anamnese_responses;
CREATE TRIGGER update_anamnese_responses_updated_at
  BEFORE UPDATE ON public.anamnese_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────── RLS ───────────────
-- O atleta pode atualizar a própria resposta (necessário p/ salvar rascunho e
-- retomar depois). Admin já possui "Admin can update anamnese responses".
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
