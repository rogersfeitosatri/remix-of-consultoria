-- ETAPA 5B — Central de IA canônica: versionamento, auditoria de execuções e rastreabilidade.

-- 1) Versões de prompt: estado canônico + configuração de modelo
ALTER TABLE public.ai_prompt_versions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS change_notes text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS temperature numeric,
  ADD COLUMN IF NOT EXISTS max_tokens integer,
  ADD COLUMN IF NOT EXISTS response_format text,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.ai_prompt_versions
    ADD CONSTRAINT ai_prompt_versions_status_check
    CHECK (status IN ('draft','active','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.ai_prompt_versions
   SET status = CASE WHEN is_active THEN 'active' ELSE 'archived' END
 WHERE status = 'draft' AND created_at < now();

UPDATE public.ai_prompt_versions
   SET change_notes = COALESCE(change_notes, note),
       activated_at = COALESCE(activated_at, CASE WHEN is_active THEN created_at END),
       activated_by = COALESCE(activated_by, CASE WHEN is_active THEN author_id END)
 WHERE change_notes IS NULL OR (is_active AND activated_at IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_versions_one_active
  ON public.ai_prompt_versions (user_id, context_key)
  WHERE status = 'active';

-- 2) Prompts: marcação de legado (Suporte WhatsApp sai da Central)
ALTER TABLE public.ai_prompts
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

UPDATE public.ai_prompts SET is_legacy = true WHERE context_key = 'whatsapp_support';

-- 3) ai_runs — auditoria de toda execução de IA
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  skill_key text NOT NULL,
  prompt_version_id uuid REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL,
  prompt_version_number integer,
  effective_prompt_hash text,
  effective_prompt_chars integer,
  provider text,
  model text,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'running',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb,
  error text,
  duration_ms integer,
  tokens_input integer,
  tokens_output integer,
  cost_estimate numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_environment_check
    CHECK (environment IN ('production','test','playground'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_status_check
    CHECK (status IN ('running','succeeded','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ai_runs_user_skill_idx ON public.ai_runs (user_id, skill_key, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_client_idx ON public.ai_runs (client_id, created_at DESC);

GRANT SELECT ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins read own ai runs" ON public.ai_runs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Rastreabilidade nas saídas persistidas
ALTER TABLE public.checkin_ai_analyses
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid,
  ADD COLUMN IF NOT EXISTS prompt_version_number integer,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS ai_run_id uuid,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS structured_output jsonb;

CREATE INDEX IF NOT EXISTS checkin_ai_analyses_response_current_idx
  ON public.checkin_ai_analyses (checkin_response_id, created_at DESC);

ALTER TABLE public.ai_analyses
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid,
  ADD COLUMN IF NOT EXISTS prompt_version_number integer,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS ai_run_id uuid;

-- 5) Ativação atômica de versão de prompt
CREATE OR REPLACE FUNCTION public.activate_ai_prompt_version(p_version_id uuid)
RETURNS public.ai_prompt_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.ai_prompt_versions;
BEGIN
  SELECT * INTO v FROM public.ai_prompt_versions WHERE id = p_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF v.user_id <> auth.uid() THEN RAISE EXCEPTION 'Sem permissão sobre esta versão'; END IF;
  IF coalesce(btrim(v.prompt_text), '') = '' THEN RAISE EXCEPTION 'Prompt vazio não pode ser ativado'; END IF;

  UPDATE public.ai_prompt_versions
     SET status = 'archived', is_active = false
   WHERE user_id = v.user_id AND context_key = v.context_key AND id <> v.id AND status = 'active';

  UPDATE public.ai_prompt_versions
     SET status = 'active', is_active = true, activated_at = now(), activated_by = auth.uid()
   WHERE id = v.id
  RETURNING * INTO v;

  INSERT INTO public.ai_prompts (user_id, context_key, prompt_text, active_version_number, updated_by, updated_at)
  VALUES (v.user_id, v.context_key, v.prompt_text, v.version_number, auth.uid(), now())
  ON CONFLICT (user_id, context_key) DO UPDATE
    SET prompt_text = EXCLUDED.prompt_text,
        active_version_number = EXCLUDED.active_version_number,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

  INSERT INTO public.operational_events (user_id, entity_type, entity_id, event_type, actor_user_id, source, metadata)
  VALUES (v.user_id, 'ai_prompt', v.id, 'ai_prompt_version_activated', auth.uid(), 'app',
          jsonb_build_object('skill', v.context_key, 'version_number', v.version_number, 'change_notes', v.change_notes));

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_ai_prompt_version(uuid) TO authenticated;