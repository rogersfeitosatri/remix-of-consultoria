-- === Migration 1: Anamnese Completa (foundation) ===
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

-- === Migration 2: AI Meal Plan Skill ===
ALTER TABLE public.ai_prompts
  ADD COLUMN IF NOT EXISTS active_version_number INTEGER,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  context_key TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL DEFAULT '',
  note TEXT,
  author_id UUID,
  author_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, context_key, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompt_versions TO service_role;
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_ctx
  ON public.ai_prompt_versions(user_id, context_key, version_number DESC);
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own prompt versions" ON public.ai_prompt_versions;
CREATE POLICY "Users manage their own prompt versions"
  ON public.ai_prompt_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_skill_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skill_key TEXT NOT NULL DEFAULT 'meal_plan_generation',
  module_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  required BOOLEAN NOT NULL DEFAULT true,
  version_number INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_key, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_skill_modules TO authenticated;
GRANT ALL ON public.ai_skill_modules TO service_role;
CREATE INDEX IF NOT EXISTS idx_ai_skill_modules_skill
  ON public.ai_skill_modules(user_id, skill_key);
ALTER TABLE public.ai_skill_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own skill modules" ON public.ai_skill_modules;
CREATE POLICY "Users manage their own skill modules"
  ON public.ai_skill_modules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_ai_skill_modules_updated_at ON public.ai_skill_modules;
CREATE TRIGGER update_ai_skill_modules_updated_at
  BEFORE UPDATE ON public.ai_skill_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID,
  context_key TEXT NOT NULL DEFAULT 'meal_plan_generation',
  prompt_version_number INTEGER,
  module_versions JSONB,
  effective_prompt_hash TEXT,
  effective_prompt_chars INTEGER,
  model TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_generation_log TO authenticated;
GRANT ALL ON public.ai_generation_log TO service_role;
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_user
  ON public.ai_generation_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_client
  ON public.ai_generation_log(client_id, created_at DESC);
ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own generation log" ON public.ai_generation_log;
CREATE POLICY "Users read their own generation log"
  ON public.ai_generation_log FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert their own generation log" ON public.ai_generation_log;
CREATE POLICY "Users insert their own generation log"
  ON public.ai_generation_log FOR INSERT WITH CHECK (auth.uid() = user_id);