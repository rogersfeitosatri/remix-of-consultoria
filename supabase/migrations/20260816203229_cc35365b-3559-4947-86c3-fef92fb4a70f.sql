-- ETAPA 5A (revisada) — Revisão estrutural do plano alimentar

-- 1. Configuração estruturada de plano/produto
ALTER TABLE public.plan_templates
  ADD COLUMN IF NOT EXISTS consultation_mode text,
  ADD COLUMN IF NOT EXISTS structural_review_mode text;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consultation_mode text,
  ADD COLUMN IF NOT EXISTS structural_review_mode text;

DO $$ BEGIN
  ALTER TABLE public.plan_templates ADD CONSTRAINT plan_templates_consultation_mode_chk
    CHECK (consultation_mode IS NULL OR consultation_mode IN ('none','initial_only','recurring'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.plan_templates ADD CONSTRAINT plan_templates_structural_review_mode_chk
    CHECK (structural_review_mode IS NULL OR structural_review_mode IN ('every_28_days','recurring_consultation'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_consultation_mode_chk
    CHECK (consultation_mode IS NULL OR consultation_mode IN ('none','initial_only','recurring'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_structural_review_mode_chk
    CHECK (structural_review_mode IS NULL OR structural_review_mode IN ('every_28_days','recurring_consultation'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Derivação canônica (usada só para backfill e fallback)
CREATE OR REPLACE FUNCTION public.derive_consultation_mode(
  p_has_consultations boolean, p_count integer, p_frequency text
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(p_has_consultations, false) = false THEN 'none'
    WHEN COALESCE(p_count, 0) > 1 THEN 'recurring'
    WHEN p_frequency IS NOT NULL AND p_frequency <> '' AND p_frequency NOT IN ('single','unica','única','none') THEN 'recurring'
    ELSE 'initial_only'
  END;
$$;

UPDATE public.plan_templates
   SET consultation_mode = COALESCE(consultation_mode,
        public.derive_consultation_mode(has_consultations, consultation_count, consultation_frequency))
 WHERE consultation_mode IS NULL;
UPDATE public.plan_templates
   SET structural_review_mode = CASE WHEN consultation_mode = 'recurring'
        THEN 'recurring_consultation' ELSE 'every_28_days' END
 WHERE structural_review_mode IS NULL;

UPDATE public.clients
   SET consultation_mode = COALESCE(consultation_mode,
        public.derive_consultation_mode(has_consultations, consultation_count, consultation_frequency))
 WHERE consultation_mode IS NULL;
UPDATE public.clients
   SET structural_review_mode = CASE WHEN consultation_mode = 'recurring'
        THEN 'recurring_consultation' ELSE 'every_28_days' END
 WHERE structural_review_mode IS NULL;

-- 2. Vínculo revisão <-> check-in
ALTER TABLE public.nutrition_reviews
  ADD COLUMN IF NOT EXISTS checkin_dispatch_id uuid REFERENCES public.checkin_dispatches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_response_id uuid REFERENCES public.checkin_responses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_structural boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_dispatch ON public.nutrition_reviews (checkin_dispatch_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_response ON public.nutrition_reviews (checkin_response_id);

-- 3. Materialização: ciclo fixo de 28 dias apenas para quem NÃO tem consulta recorrente
CREATE OR REPLACE FUNCTION public.materialize_nutrition_reviews(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (created integer, paused integer, resumed integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_created integer := 0; v_paused integer := 0; v_resumed integer := 0;
  r record; v_interval integer; v_cycle_start date; v_base date; v_next date;
  v_today date := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
  -- congelado: pausa (não acumula backlog)
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

  -- consulta recorrente: a consulta É a revisão estrutural -> cancelar paralelas
  UPDATE public.nutrition_reviews nr
     SET status = 'cancelled', cancel_reason = 'recurring_consultation'
    FROM public.clients c
   WHERE nr.client_id = c.id
     AND nr.status IN ('scheduled','pending','waiting_information','in_review','paused')
     AND COALESCE(c.structural_review_mode,
          CASE WHEN public.derive_consultation_mode(c.has_consultations, c.consultation_count, c.consultation_frequency) = 'recurring'
               THEN 'recurring_consultation' ELSE 'every_28_days' END) = 'recurring_consultation'
     AND (p_user_id IS NULL OR nr.user_id = p_user_id);

  FOR r IN
    SELECT c.id, c.user_id, c.start_date, c.nutrition_review_interval_days
      FROM public.clients c
     WHERE COALESCE(c.is_active, true) = true
       AND COALESCE(c.is_frozen, false) = false
       AND c.archived_at IS NULL AND c.ended_at IS NULL
       AND (c.end_date IS NULL OR c.end_date >= v_today)
       AND COALESCE(c.service_type, 'nutrition') IN ('nutrition','both')
       AND COALESCE(c.structural_review_mode,
            CASE WHEN public.derive_consultation_mode(c.has_consultations, c.consultation_count, c.consultation_frequency) = 'recurring'
                 THEN 'recurring_consultation' ELSE 'every_28_days' END) = 'every_28_days'
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
      (user_id, client_id, cycle_key, cycle_start, scheduled_for, interval_days, status, source, is_structural)
    VALUES (r.user_id, r.id, v_cycle_start::text, v_cycle_start, v_next, v_interval,
            CASE WHEN v_next <= v_today THEN 'pending' ELSE 'scheduled' END, 'cadence', true)
    ON CONFLICT DO NOTHING;
    v_created := v_created + 1;
  END LOOP;

  RETURN QUERY SELECT v_created, v_paused, v_resumed;
END; $$;

REVOKE ALL ON FUNCTION public.materialize_nutrition_reviews(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.materialize_nutrition_reviews(uuid) TO authenticated, service_role;

-- 4. Vincular o check-in do ciclo à revisão (não cria check-in extra)
CREATE OR REPLACE FUNCTION public.link_checkin_dispatch_to_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_date date;
  v_review_id uuid;
BEGIN
  v_date := COALESCE(NEW.occurrence_date, (NEW.scheduled_for AT TIME ZONE 'America/Fortaleza')::date,
                     (NEW.sent_at AT TIME ZONE 'America/Fortaleza')::date);
  IF v_date IS NULL THEN RETURN NEW; END IF;

  SELECT nr.id INTO v_review_id
    FROM public.nutrition_reviews nr
   WHERE nr.client_id = NEW.client_id
     AND nr.status IN ('scheduled','pending','waiting_information','in_review','paused')
     AND nr.checkin_dispatch_id IS NULL
     AND ABS(nr.scheduled_for - v_date) <= GREATEST(1, (nr.interval_days / 2) - 1)
   ORDER BY ABS(nr.scheduled_for - v_date)
   LIMIT 1;

  IF v_review_id IS NOT NULL THEN
    UPDATE public.nutrition_reviews
       SET checkin_dispatch_id = NEW.id,
           metadata = metadata || jsonb_build_object('linked_dispatch_date', v_date)
     WHERE id = v_review_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_dispatch_to_review ON public.checkin_dispatches;
CREATE TRIGGER trg_link_dispatch_to_review
AFTER INSERT ON public.checkin_dispatches
FOR EACH ROW EXECUTE FUNCTION public.link_checkin_dispatch_to_review();

CREATE OR REPLACE FUNCTION public.link_checkin_response_to_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dispatch_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.nutrition_reviews
     SET checkin_response_id = NEW.id,
         needs_review = true
   WHERE checkin_dispatch_id = NEW.dispatch_id
     AND checkin_response_id IS NULL
     AND status IN ('scheduled','pending','waiting_information','in_review','paused');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_response_to_review ON public.checkin_responses;
CREATE TRIGGER trg_link_response_to_review
AFTER INSERT ON public.checkin_responses
FOR EACH ROW EXECUTE FUNCTION public.link_checkin_response_to_review();

-- 5. Reprocessa a cadência com as novas regras
SELECT public.materialize_nutrition_reviews(NULL);