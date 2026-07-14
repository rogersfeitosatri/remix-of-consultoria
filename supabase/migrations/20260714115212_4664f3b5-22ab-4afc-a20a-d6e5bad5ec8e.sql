-- Pipeline persistente de geração do plano alimentar em múltiplas etapas.
CREATE TABLE IF NOT EXISTS public.plan_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','generating_blueprint','generating_days','validating','completed','partially_failed','failed')),
  current_stage text,
  weekly_blueprint jsonb,
  admin_guidance jsonb,
  completed_days integer NOT NULL DEFAULT 0,
  total_days integer NOT NULL DEFAULT 7,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_jobs_client ON public.plan_generation_jobs(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_jobs_user ON public.plan_generation_jobs(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_generation_jobs TO authenticated;
GRANT ALL ON public.plan_generation_jobs TO service_role;
ALTER TABLE public.plan_generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_jobs owner all" ON public.plan_generation_jobs;
CREATE POLICY "plan_jobs owner all" ON public.plan_generation_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.plan_generation_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.plan_generation_jobs(id) ON DELETE CASCADE,
  weekday text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','generating','validating','completed','correction_required','failed')),
  attempts integer NOT NULL DEFAULT 0,
  strategy_input jsonb,
  menu_output jsonb,
  validation_result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, weekday)
);
CREATE INDEX IF NOT EXISTS idx_plan_days_job ON public.plan_generation_days(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_generation_days TO authenticated;
GRANT ALL ON public.plan_generation_days TO service_role;
ALTER TABLE public.plan_generation_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_days owner all" ON public.plan_generation_days;
CREATE POLICY "plan_days owner all" ON public.plan_generation_days FOR ALL
  USING (EXISTS (SELECT 1 FROM public.plan_generation_jobs j WHERE j.id = plan_generation_days.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.plan_generation_jobs j WHERE j.id = plan_generation_days.job_id AND j.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.substitution_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.plan_generation_jobs(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  main_macro text,
  target_g numeric,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, group_key)
);
CREATE INDEX IF NOT EXISTS idx_sub_groups_job ON public.substitution_groups(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.substitution_groups TO authenticated;
GRANT ALL ON public.substitution_groups TO service_role;
ALTER TABLE public.substitution_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_groups owner all" ON public.substitution_groups;
CREATE POLICY "sub_groups owner all" ON public.substitution_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.plan_generation_jobs j WHERE j.id = substitution_groups.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.plan_generation_jobs j WHERE j.id = substitution_groups.job_id AND j.user_id = auth.uid()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_plan_jobs_updated ON public.plan_generation_jobs;
    CREATE TRIGGER trg_plan_jobs_updated BEFORE UPDATE ON public.plan_generation_jobs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_plan_days_updated ON public.plan_generation_days;
    CREATE TRIGGER trg_plan_days_updated BEFORE UPDATE ON public.plan_generation_days
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';