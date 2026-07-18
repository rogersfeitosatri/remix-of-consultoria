-- Central de IA — habilidade "Plano alimentar": versionamento do prompt,
-- módulos complementares e log de geração. Aditivo e idempotente. Reutiliza
-- ai_prompts como "ponteiro ativo" (as edge functions continuam lendo dela).

-- ─────────── ai_prompts: metadados da versão ativa ───────────
ALTER TABLE public.ai_prompts
  ADD COLUMN IF NOT EXISTS active_version_number INTEGER,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ─────────── Histórico de versões do prompt principal ───────────
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
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_ctx
  ON public.ai_prompt_versions(user_id, context_key, version_number DESC);
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own prompt versions" ON public.ai_prompt_versions;
CREATE POLICY "Users manage their own prompt versions"
  ON public.ai_prompt_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────── Módulos complementares da habilidade ───────────
CREATE TABLE IF NOT EXISTS public.ai_skill_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skill_key TEXT NOT NULL DEFAULT 'meal_plan_generation',
  module_key TEXT NOT NULL,               -- ex.: nutricao-esportiva-funcional
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  required BOOLEAN NOT NULL DEFAULT true,  -- pdf-importador entra como required=false
  version_number INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_key, module_key)
);
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

-- ─────────── Log de geração (versões exatas usadas por plano) ───────────
CREATE TABLE IF NOT EXISTS public.ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID,
  context_key TEXT NOT NULL DEFAULT 'meal_plan_generation',
  prompt_version_number INTEGER,
  module_versions JSONB,                  -- [{module_key, version_number}]
  effective_prompt_hash TEXT,
  effective_prompt_chars INTEGER,
  model TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
-- service_role (edge functions) ignora RLS; a policy acima cobre inserts do app.
