CREATE TABLE IF NOT EXISTS public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  event_type text NOT NULL,
  actor_user_id uuid NULL DEFAULT auth.uid(),
  source text NOT NULL DEFAULT 'app',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.operational_events TO authenticated;
GRANT ALL ON public.operational_events TO service_role;

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operational_events' AND policyname='oe_select_own') THEN
    CREATE POLICY oe_select_own ON public.operational_events
      FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operational_events' AND policyname='oe_insert_own') THEN
    CREATE POLICY oe_insert_own ON public.operational_events
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operational_events_client ON public.operational_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_entity ON public.operational_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_type ON public.operational_events(event_type, created_at DESC);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ended_at timestamptz NULL;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS frozen_at timestamptz NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS frozen_from_status text NULL;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_type text NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_id uuid NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_mode text NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tasks_completion_mode_check') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_completion_mode_check
      CHECK (completion_mode IN ('manual','derived'));
  END IF;
END $$;

UPDATE public.tasks
   SET completion_mode = 'derived',
       source_type = COALESCE(source_type, source::text)
 WHERE completion_mode = 'manual'
   AND source::text <> 'manual';

CREATE INDEX IF NOT EXISTS idx_tasks_source_ref ON public.tasks(source_type, source_id);

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'national',
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_unique ON public.holidays(holiday_date, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='holidays' AND policyname='holidays_read') THEN
    CREATE POLICY holidays_read ON public.holidays
      FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='holidays' AND policyname='holidays_write_own') THEN
    CREATE POLICY holidays_write_own ON public.holidays
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

INSERT INTO public.holidays (holiday_date, name, scope)
SELECT t.d::date, t.n, 'national'
FROM (VALUES
  ('2026-01-01','Confraternizacao Universal'),
  ('2026-02-17','Carnaval'),
  ('2026-04-03','Sexta-feira Santa'),
  ('2026-04-21','Tiradentes'),
  ('2026-05-01','Dia do Trabalho'),
  ('2026-06-04','Corpus Christi'),
  ('2026-09-07','Independencia'),
  ('2026-10-12','Nossa Senhora Aparecida'),
  ('2026-11-02','Finados'),
  ('2026-11-15','Proclamacao da Republica'),
  ('2026-12-25','Natal'),
  ('2027-01-01','Confraternizacao Universal'),
  ('2027-02-09','Carnaval'),
  ('2027-03-26','Sexta-feira Santa'),
  ('2027-04-21','Tiradentes'),
  ('2027-05-01','Dia do Trabalho'),
  ('2027-05-27','Corpus Christi'),
  ('2027-09-07','Independencia'),
  ('2027-10-12','Nossa Senhora Aparecida'),
  ('2027-11-02','Finados'),
  ('2027-11-15','Proclamacao da Republica'),
  ('2027-12-25','Natal')
) AS t(d,n)
WHERE NOT EXISTS (
  SELECT 1 FROM public.holidays h WHERE h.holiday_date = t.d::date AND h.user_id IS NULL
);

CREATE OR REPLACE FUNCTION public.is_business_day(p_date date, p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(ISODOW FROM p_date) < 6
     AND NOT EXISTS (
       SELECT 1 FROM public.holidays h
        WHERE h.holiday_date = p_date
          AND (h.user_id IS NULL OR h.user_id = p_user_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.add_business_days(p_from date, p_days integer, p_user_id uuid DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := p_from;
  remaining integer := GREATEST(COALESCE(p_days,0), 0);
BEGIN
  WHILE remaining > 0 LOOP
    d := d + 1;
    IF public.is_business_day(d, p_user_id) THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  RETURN d;
END;
$$;

CREATE OR REPLACE VIEW public.v_client_operational_state AS
SELECT
  c.id AS client_id,
  c.user_id,
  c.name,
  c.is_active,
  COALESCE(c.is_frozen,false) AS is_frozen,
  (c.archived_at IS NOT NULL) AS is_archived,
  (c.end_date IS NOT NULL AND c.end_date < CURRENT_DATE) AS is_ended,
  (c.athlete_status = 'pending_anamnese') AS is_in_onboarding,
  (c.service_type IN ('nutrition','both')) AS has_nutrition,
  (c.service_type IN ('training','both')) AS has_training,
  COALESCE(c.has_consultations,false) AS has_consultations,
  (
    c.is_active
    AND NOT COALESCE(c.is_frozen,false)
    AND c.archived_at IS NULL
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
  ) AS is_operational
FROM public.clients c;

GRANT SELECT ON public.v_client_operational_state TO authenticated;
GRANT SELECT ON public.v_client_operational_state TO service_role;

CREATE OR REPLACE FUNCTION public.is_client_operational(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT c.is_active
       AND NOT COALESCE(c.is_frozen,false)
       AND c.archived_at IS NULL
       AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
    FROM public.clients c WHERE c.id = _client_id
  ), false);
$$;

ALTER TABLE public.np_athlete_races ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

INSERT INTO public.np_athlete_races (client_id, user_id, race_name, race_date, race_distance_km, is_active, source, notes)
SELECT ap.client_id, c.user_id, ap.target_race,
       ap.target_deadline::date, 0, true, 'backfill_athlete_profiles',
       'Backfill Etapa 1 a partir de athlete_profiles (distancia a revisar)'
FROM public.athlete_profiles ap
JOIN public.clients c ON c.id = ap.client_id
WHERE COALESCE(ap.target_race,'') <> ''
  AND ap.target_deadline ~ '^\d{4}-\d{2}-\d{2}$'
  AND NOT EXISTS (SELECT 1 FROM public.np_athlete_races r WHERE r.client_id = ap.client_id);

CREATE OR REPLACE VIEW public.v_athlete_current_target_race AS
SELECT DISTINCT ON (r.client_id)
  r.client_id,
  r.id AS race_id,
  r.race_name,
  r.race_date,
  r.race_type,
  r.race_distance_km,
  r.target_time_minutes,
  r.source
FROM public.np_athlete_races r
WHERE r.is_active
ORDER BY r.client_id, r.race_date NULLS LAST, r.created_at DESC;

GRANT SELECT ON public.v_athlete_current_target_race TO authenticated;
GRANT SELECT ON public.v_athlete_current_target_race TO service_role;