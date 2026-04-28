-- =====================================================================
-- NutriPeriodiza — Fase 1 (MVP): Race Prep / Preparação de Prova
-- Módulo isolado coexistindo com Periodização Metabólica existente.
-- Prefixo "np_" para clareza e separação.
-- =====================================================================

-- 1) Estender target_races (sem criar athlete_race_goals)
ALTER TABLE public.target_races
  ADD COLUMN IF NOT EXISTS race_distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS race_type TEXT DEFAULT 'road',
  ADD COLUMN IF NOT EXISTS target_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2) np_gut_training_logs — registros de progressão intestinal
CREATE TABLE IF NOT EXISTS public.np_gut_training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_cho_rate_g_h NUMERIC(5,1),
  cho_source TEXT,
  adherence_pct INTEGER CHECK (adherence_pct BETWEEN 0 AND 100),
  gi_nausea NUMERIC(3,1) DEFAULT 0,
  gi_bloating NUMERIC(3,1) DEFAULT 0,
  gi_cramps NUMERIC(3,1) DEFAULT 0,
  gi_diarrhea NUMERIC(3,1) DEFAULT 0,
  gi_score_global NUMERIC(3,1) GENERATED ALWAYS AS (
    ROUND(((COALESCE(gi_nausea,0) + COALESCE(gi_bloating,0) + COALESCE(gi_cramps,0) + COALESCE(gi_diarrhea,0)) / 4.0)::numeric, 1)
  ) STORED,
  decision TEXT CHECK (decision IN ('advance','maintain','regress')),
  next_cho_rate_g_h NUMERIC(5,1),
  nutritionist_notes TEXT,
  athlete_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_np_gut_logs_client ON public.np_gut_training_logs(client_id, checkin_date DESC);
ALTER TABLE public.np_gut_training_logs ENABLE ROW LEVEL SECURITY;

-- 3) np_phase_protocols — override manual + checklist carbo-loading
CREATE TABLE IF NOT EXISTS public.np_phase_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  race_goal_id UUID REFERENCES public.target_races(id) ON DELETE SET NULL,
  current_phase TEXT CHECK (current_phase IN ('base','build','specific','peak','taper','race')),
  weeks_to_race INTEGER,
  cho_daily_range TEXT,
  cho_pre_protocol TEXT,
  cho_intra_target_g_h NUMERIC(5,1),
  cho_intra_protocol TEXT,
  carboloading_protocol TEXT,
  carboloading_active BOOLEAN DEFAULT false,
  carboloading_checklist JSONB DEFAULT '{}'::jsonb,
  gut_training_target_g_h NUMERIC(5,1),
  phase_override TEXT,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.np_phase_protocols ENABLE ROW LEVEL SECURITY;

-- 4) np_protocol_defaults — defaults editáveis por admin (por fase x distância)
CREATE TABLE IF NOT EXISTS public.np_protocol_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('base','build','specific','peak','taper','race')),
  distance_category TEXT NOT NULL CHECK (distance_category IN ('5k_10k','half','marathon','ultra')),
  cho_daily_range TEXT,
  gut_training_description TEXT,
  pre_training_protocol TEXT,
  cho_intra_min_g_h NUMERIC(5,1),
  cho_intra_max_g_h NUMERIC(5,1),
  cho_intra_description TEXT,
  cho_intra_source TEXT,
  carboloading_indicated BOOLEAN DEFAULT false,
  carboloading_protocol TEXT,
  carboloading_duration_days INTEGER,
  carboloading_min_gkg NUMERIC(4,1),
  carboloading_max_gkg NUMERIC(4,1),
  clinical_focus TEXT,
  alerts_contraindications TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, phase, distance_category)
);
ALTER TABLE public.np_protocol_defaults ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS Policies — admin (owner) tem acesso total; atletas via client.user_id
-- =====================================================================

-- np_gut_training_logs
CREATE POLICY "np_gut_logs_admin_all" ON public.np_gut_training_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "np_gut_logs_athlete_select" ON public.np_gut_training_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = np_gut_training_logs.client_id
              AND c.athlete_user_id = auth.uid())
  );

-- np_phase_protocols
CREATE POLICY "np_phase_admin_all" ON public.np_phase_protocols
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "np_phase_athlete_select" ON public.np_phase_protocols
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = np_phase_protocols.client_id
              AND c.athlete_user_id = auth.uid())
  );

-- np_protocol_defaults
CREATE POLICY "np_defaults_admin_all" ON public.np_protocol_defaults
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- Triggers de updated_at (reusa função existente public.update_updated_at_column)
-- =====================================================================
CREATE TRIGGER trg_np_phase_protocols_updated
  BEFORE UPDATE ON public.np_phase_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_np_protocol_defaults_updated
  BEFORE UPDATE ON public.np_protocol_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_target_races_updated
  BEFORE UPDATE ON public.target_races
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();