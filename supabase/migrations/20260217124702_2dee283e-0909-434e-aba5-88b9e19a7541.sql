
-- =============================================
-- JORNADA DE PERIODIZAÇÃO DO ATLETA
-- Schema completo para o módulo de jornada
-- =============================================

-- 1. Fases da jornada de cada atleta (seção 2 e 3)
CREATE TABLE public.journey_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_periodization_id UUID NOT NULL REFERENCES public.athlete_periodization(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phase_name TEXT NOT NULL, -- Base, Específica, Competitiva, Pico, Transição
  phase_order INT NOT NULL DEFAULT 0,
  duration_weeks INT NOT NULL DEFAULT 4,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed
  -- Tabela Estrutural (seção 3)
  objective TEXT,
  cho_range TEXT, -- ex: "3-5 g/kg"
  train_low_strategy TEXT, -- "permitido", "reduzido", "proibido"
  recovery_strategy TEXT,
  body_comp_strategy TEXT,
  supplement_base TEXT,
  strategic_notes TEXT,
  -- Suplementação por fase (seção 8)
  creatine TEXT,
  beta_alanine TEXT,
  caffeine TEXT,
  nitrate TEXT,
  supplement_general TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Semanas dentro de cada fase (seção 4)
CREATE TABLE public.journey_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_phase_id UUID NOT NULL REFERENCES public.journey_phases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_number INT NOT NULL, -- semana global (1..N)
  week_in_phase INT NOT NULL, -- semana dentro da fase (1..M)
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Sessões de treino dentro de cada semana (seção 4)
CREATE TABLE public.journey_week_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_week_id UUID NOT NULL REFERENCES public.journey_weeks(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Seg, 6=Dom
  modality TEXT, -- corrida, bike, natação, musculação, descanso
  shift TEXT, -- manhã, tarde, noite
  intensity TEXT, -- leve, moderado, intenso
  priority TEXT, -- A, B, C
  metabolic_objective TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Dinâmica nutricional diária - gerada pela IA (seção 5)
CREATE TABLE public.journey_day_dynamics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_week_id UUID NOT NULL REFERENCES public.journey_weeks(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  cho_classification TEXT, -- high, medium, low
  pre_training TEXT,
  intra_training TEXT,
  post_training TEXT,
  night_guidance TEXT,
  notes TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.journey_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_week_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_day_dynamics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: admin access via user_id
CREATE POLICY "Admin manages journey phases" ON public.journey_phases
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admin manages journey weeks" ON public.journey_weeks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admin manages week sessions" ON public.journey_week_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.journey_weeks jw
      WHERE jw.id = journey_week_sessions.journey_week_id
      AND jw.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages day dynamics" ON public.journey_day_dynamics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.journey_weeks jw
      WHERE jw.id = journey_day_dynamics.journey_week_id
      AND jw.user_id = auth.uid()
    )
  );

-- Updated_at triggers
CREATE TRIGGER update_journey_phases_updated_at
  BEFORE UPDATE ON public.journey_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journey_weeks_updated_at
  BEFORE UPDATE ON public.journey_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
