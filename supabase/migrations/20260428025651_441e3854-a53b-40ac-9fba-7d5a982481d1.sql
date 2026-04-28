-- 1) Links únicos para o check-in de periodização
CREATE TABLE IF NOT EXISTS public.np_periodization_checkin_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_pcl_client ON public.np_periodization_checkin_links(client_id);
CREATE INDEX IF NOT EXISTS idx_np_pcl_token ON public.np_periodization_checkin_links(token);

ALTER TABLE public.np_periodization_checkin_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage own np checkin links"
ON public.np_periodization_checkin_links
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_np_pcl_updated_at
BEFORE UPDATE ON public.np_periodization_checkin_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Respostas do check-in de periodização
CREATE TABLE IF NOT EXISTS public.np_periodization_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  link_id UUID REFERENCES public.np_periodization_checkin_links(id) ON DELETE SET NULL,
  race_id UUID,
  phase TEXT,
  adherence_pct INTEGER CHECK (adherence_pct BETWEEN 0 AND 100),
  gi_score INTEGER CHECK (gi_score BETWEEN 0 AND 10),
  energy_score INTEGER CHECK (energy_score BETWEEN 0 AND 10),
  sleep_score INTEGER CHECK (sleep_score BETWEEN 0 AND 10),
  weight_kg NUMERIC(5,2),
  weekly_mileage_km NUMERIC(6,2),
  long_run_completed BOOLEAN,
  notes TEXT,
  symptoms JSONB DEFAULT '[]'::jsonb,
  decision TEXT CHECK (decision IN ('advance','maintain','regress')),
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_pc_client ON public.np_periodization_checkins(client_id);
CREATE INDEX IF NOT EXISTS idx_np_pc_user ON public.np_periodization_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_np_pc_submitted ON public.np_periodization_checkins(submitted_at DESC);

ALTER TABLE public.np_periodization_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage own np checkins"
ON public.np_periodization_checkins
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_np_pc_updated_at
BEFORE UPDATE ON public.np_periodization_checkins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Estende np_evolution_summaries
ALTER TABLE public.np_evolution_summaries
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_content TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'np_evolution_summaries_audience_chk'
  ) THEN
    ALTER TABLE public.np_evolution_summaries
      ADD CONSTRAINT np_evolution_summaries_audience_chk
      CHECK (audience IN ('admin','athlete'));
  END IF;
END $$;

-- 4) Função pública para resolver contexto do link (anônimo)
CREATE OR REPLACE FUNCTION public.get_np_checkin_context(p_token TEXT)
RETURNS TABLE(
  link_id UUID,
  client_id UUID,
  client_name TEXT,
  admin_user_id UUID,
  race_name TEXT,
  race_date DATE
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS link_id,
    l.client_id,
    c.name AS client_name,
    c.user_id AS admin_user_id,
    r.race_name,
    r.race_date
  FROM public.np_periodization_checkin_links l
  JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.np_athlete_races r ON r.client_id = l.client_id AND r.is_active = true
  WHERE l.token = p_token
    AND l.active = true
    AND (l.expires_at IS NULL OR l.expires_at > now())
  LIMIT 1;
$$;