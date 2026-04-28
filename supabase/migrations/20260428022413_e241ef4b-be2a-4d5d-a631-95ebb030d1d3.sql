-- Reverter ALTER em target_races (foi um equívoco — é biblioteca compartilhada)
ALTER TABLE public.target_races DROP COLUMN IF EXISTS race_distance_km;
ALTER TABLE public.target_races DROP COLUMN IF EXISTS race_type;
ALTER TABLE public.target_races DROP COLUMN IF EXISTS target_time_minutes;
ALTER TABLE public.target_races DROP COLUMN IF EXISTS is_active;
ALTER TABLE public.target_races DROP COLUMN IF EXISTS updated_at;
DROP TRIGGER IF EXISTS trg_target_races_updated ON public.target_races;

-- Criar tabela dedicada para a prova-alvo individual do atleta no NutriPeriodiza
CREATE TABLE IF NOT EXISTS public.np_athlete_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  race_name TEXT,
  race_date DATE NOT NULL,
  race_distance_km NUMERIC NOT NULL,
  race_type TEXT NOT NULL DEFAULT 'road' CHECK (race_type IN ('road','trail','track')),
  target_time_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_athlete_races_client ON public.np_athlete_races(client_id, is_active, race_date);

-- Garantir apenas uma prova ativa por atleta
CREATE UNIQUE INDEX IF NOT EXISTS uq_np_athlete_races_one_active
  ON public.np_athlete_races(client_id) WHERE is_active = true;

ALTER TABLE public.np_athlete_races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "np_races_admin_all" ON public.np_athlete_races
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "np_races_athlete_select" ON public.np_athlete_races
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = np_athlete_races.client_id
              AND c.athlete_user_id = auth.uid())
  );

CREATE TRIGGER trg_np_athlete_races_updated
  BEFORE UPDATE ON public.np_athlete_races
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar a FK de np_phase_protocols para apontar para np_athlete_races
ALTER TABLE public.np_phase_protocols
  DROP CONSTRAINT IF EXISTS np_phase_protocols_race_goal_id_fkey;

ALTER TABLE public.np_phase_protocols
  ADD CONSTRAINT np_phase_protocols_race_goal_id_fkey
  FOREIGN KEY (race_goal_id) REFERENCES public.np_athlete_races(id) ON DELETE SET NULL;