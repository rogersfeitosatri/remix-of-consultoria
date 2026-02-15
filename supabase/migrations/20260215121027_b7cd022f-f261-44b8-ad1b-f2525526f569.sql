
-- =============================================
-- GLOBAL PERIODIZATION METHOD (1 active per admin)
-- =============================================
CREATE TABLE public.periodization_method (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  method_name TEXT NOT NULL DEFAULT 'Método Periodiza',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.periodization_method ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages own methods" ON public.periodization_method FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- PHASES OF THE METHOD (ordered list per method)
-- =============================================
CREATE TABLE public.periodization_method_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_id UUID NOT NULL REFERENCES public.periodization_method(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  phase_order INT NOT NULL DEFAULT 0,
  phase_goal TEXT,
  macro_targets JSONB DEFAULT '[]'::jsonb,
  supplementation_daily JSONB DEFAULT '[]'::jsonb,
  pre_intra_long_run JSONB DEFAULT '{}'::jsonb,
  functional_support JSONB DEFAULT '[]'::jsonb,
  do_checklist JSONB DEFAULT '[]'::jsonb,
  avoid_checklist JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.periodization_method_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages phases via method" ON public.periodization_method_phases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.periodization_method m WHERE m.id = method_id AND m.user_id = auth.uid())
  );

-- =============================================
-- ATHLETE PERIODIZATION (per athlete timeline)
-- =============================================
CREATE TABLE public.athlete_periodization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  method_id UUID NOT NULL REFERENCES public.periodization_method(id),
  start_date DATE NOT NULL,
  race_date DATE NOT NULL,
  plan_adjustment_type TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_adjustment_type IN ('monthly', '6_weeks')),
  timeline_blocks JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.athlete_periodization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages athlete periodization" ON public.athlete_periodization FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- ATHLETE NOTES BY PHASE (optional per-athlete overrides)
-- =============================================
CREATE TABLE public.athlete_periodization_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_periodization_id UUID NOT NULL REFERENCES public.athlete_periodization(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES public.periodization_method_phases(id) ON DELETE CASCADE,
  block_index INT,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_periodization_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages athlete notes" ON public.athlete_periodization_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.athlete_periodization ap WHERE ap.id = athlete_periodization_id AND ap.user_id = auth.uid())
  );

-- =============================================
-- METHOD CHANGE LOG (simple versioning)
-- =============================================
CREATE TABLE public.periodization_method_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_id UUID NOT NULL REFERENCES public.periodization_method(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  change_description TEXT NOT NULL,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.periodization_method_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads own logs" ON public.periodization_method_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.periodization_method m WHERE m.id = method_id AND m.user_id = auth.uid())
  );
