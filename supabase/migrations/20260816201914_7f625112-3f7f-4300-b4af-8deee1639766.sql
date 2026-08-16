-- ETAPA 5A — Revisões nutricionais canônicas
ALTER TABLE public.plan_templates ADD COLUMN IF NOT EXISTS nutrition_review_interval_days integer;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nutrition_review_interval_days integer;

CREATE TABLE IF NOT EXISTS public.nutrition_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cycle_key text NOT NULL DEFAULT 'default',
  cycle_start date,
  scheduled_for date NOT NULL,
  interval_days integer NOT NULL DEFAULT 28,
  status text NOT NULL DEFAULT 'scheduled',
  decision text,
  source text NOT NULL DEFAULT 'cadence',
  override_without_checkin boolean NOT NULL DEFAULT false,
  missing_information text,
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  source_plan_version_id uuid REFERENCES public.meal_plan_versions(id) ON DELETE SET NULL,
  result_plan_version_id uuid REFERENCES public.meal_plan_versions(id) ON DELETE SET NULL,
  needs_review boolean NOT NULL DEFAULT false,
  cancel_reason text,
  last_notified_at timestamptz,
  notification_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_reviews_status_chk CHECK (status IN ('scheduled','pending','waiting_information','in_review','paused','completed','cancelled')),
  CONSTRAINT nutrition_reviews_decision_chk CHECK (decision IS NULL OR decision IN ('no_change','change_proposed','change_published','manual_override','not_applicable')),
  CONSTRAINT nutrition_reviews_source_chk CHECK (source IN ('cadence','manual_extra_review','migrated'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_reviews TO authenticated;
GRANT ALL ON public.nutrition_reviews TO service_role;
ALTER TABLE public.nutrition_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages own nutrition reviews" ON public.nutrition_reviews;
CREATE POLICY "admin manages own nutrition reviews"
  ON public.nutrition_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_reviews_cycle_date
  ON public.nutrition_reviews (client_id, cycle_key, scheduled_for) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_open ON public.nutrition_reviews (user_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_client ON public.nutrition_reviews (client_id, scheduled_for DESC);

DROP TRIGGER IF EXISTS trg_nutrition_reviews_updated ON public.nutrition_reviews;
CREATE TRIGGER trg_nutrition_reviews_updated BEFORE UPDATE ON public.nutrition_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meal_plan_change_proposals
  ADD COLUMN IF NOT EXISTS nutrition_review_id uuid REFERENCES public.nutrition_reviews(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.materialize_nutrition_reviews(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (created integer, paused integer, resumed integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_created integer := 0; v_paused integer := 0; v_resumed integer := 0;
  r record; v_interval integer; v_cycle_start date; v_base date; v_next date;
  v_today date := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
  UPDATE public.nutrition_reviews nr SET status = 'paused'
    FROM public.clients c
   WHERE nr.client_id = c.id AND c.is_frozen = true
     AND nr.status IN ('scheduled','pending','waiting_information','in_review')
     AND (p_user_id IS NULL OR nr.user_id = p_user_id);
  GET DIAGNOSTICS v_paused = ROW_COUNT;

  UPDATE public.nutrition_reviews nr
     SET status = 'scheduled', needs_review = true,
         metadata = nr.metadata || jsonb_build_object('resumed_at', now())
    FROM public.clients c
   WHERE nr.client_id = c.id AND COALESCE(c.is_frozen, false) = false
     AND nr.status = 'paused'
     AND (p_user_id IS NULL OR nr.user_id = p_user_id);
  GET DIAGNOSTICS v_resumed = ROW_COUNT;

  FOR r IN
    SELECT c.id, c.user_id, c.start_date, c.nutrition_review_interval_days
      FROM public.clients c
     WHERE COALESCE(c.is_active, true) = true
       AND COALESCE(c.is_frozen, false) = false
       AND c.archived_at IS NULL AND c.ended_at IS NULL
       AND (c.end_date IS NULL OR c.end_date >= v_today)
       AND COALESCE(c.service_type, 'nutrition') IN ('nutrition','both')
       AND (p_user_id IS NULL OR c.user_id = p_user_id)
  LOOP
    IF EXISTS (SELECT 1 FROM public.nutrition_reviews nr WHERE nr.client_id = r.id
                AND nr.status IN ('scheduled','pending','waiting_information','in_review','paused')) THEN
      CONTINUE;
    END IF;

    v_interval := COALESCE(r.nutrition_review_interval_days, 28);
    v_cycle_start := COALESCE(r.start_date, v_today);

    SELECT MAX(nr.scheduled_for) INTO v_base FROM public.nutrition_reviews nr
     WHERE nr.client_id = r.id AND nr.cycle_key = v_cycle_start::text
       AND nr.status IN ('completed','cancelled');

    v_base := COALESCE(v_base, v_cycle_start);
    v_next := v_base + v_interval;
    WHILE v_next + v_interval <= v_today LOOP v_next := v_next + v_interval; END LOOP;

    INSERT INTO public.nutrition_reviews
      (user_id, client_id, cycle_key, cycle_start, scheduled_for, interval_days, status, source)
    VALUES (r.user_id, r.id, v_cycle_start::text, v_cycle_start, v_next, v_interval,
            CASE WHEN v_next <= v_today THEN 'pending' ELSE 'scheduled' END, 'cadence')
    ON CONFLICT DO NOTHING;
    v_created := v_created + 1;
  END LOOP;

  RETURN QUERY SELECT v_created, v_paused, v_resumed;
END; $$;

REVOKE ALL ON FUNCTION public.materialize_nutrition_reviews(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.materialize_nutrition_reviews(uuid) TO authenticated, service_role;

SELECT public.materialize_nutrition_reviews(NULL);

UPDATE public.nutrition_reviews
   SET source = 'migrated', needs_review = true
 WHERE status = 'pending' AND created_at > now() - interval '5 minutes';