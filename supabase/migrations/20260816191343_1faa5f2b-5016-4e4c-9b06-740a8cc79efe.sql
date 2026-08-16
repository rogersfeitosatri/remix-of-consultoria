
-- ============================================================
-- ETAPA 3B — CHECK-INS CANÔNICOS
-- ============================================================

-- 0) RELATÓRIO PRÉ-MIGRAÇÃO (auditoria, nunca apagado)
CREATE TABLE IF NOT EXISTS public.checkin_migration_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  metric text NOT NULL,
  value bigint NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.checkin_migration_report TO authenticated;
GRANT ALL ON public.checkin_migration_report TO service_role;
ALTER TABLE public.checkin_migration_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read checkin migration report" ON public.checkin_migration_report;
CREATE POLICY "admins read checkin migration report" ON public.checkin_migration_report
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.checkin_migration_report (label, metric, value)
SELECT 'etapa3b_before', m, v FROM (
  VALUES
    ('checkin_responses', (SELECT count(*) FROM public.checkin_responses)),
    ('checkin_feedbacks', (SELECT count(*) FROM public.checkin_feedbacks)),
    ('checkin_feedbacks_sent', (SELECT count(*) FROM public.checkin_feedbacks WHERE status = 'sent')),
    ('checkin_dispatches', (SELECT count(*) FROM public.checkin_dispatches)),
    ('checkin_dispatches_no_schedule', (SELECT count(*) FROM public.checkin_dispatches WHERE schedule_id IS NULL)),
    ('athlete_checkin_schedules', (SELECT count(*) FROM public.athlete_checkin_schedules)),
    ('athlete_checkin_schedules_active', (SELECT count(*) FROM public.athlete_checkin_schedules WHERE is_active)),
    ('scheduled_checkins_legacy_total', (SELECT count(*) FROM public.scheduled_checkins)),
    ('scheduled_checkins_legacy_future', (SELECT count(*) FROM public.scheduled_checkins WHERE scheduled_send_date >= current_date)),
    ('scheduled_checkins_legacy_pending', (SELECT count(*) FROM public.scheduled_checkins WHERE status = 'pending')),
    ('checkin_ai_analyses', (SELECT count(*) FROM public.checkin_ai_analyses))
) AS t(m, v)
WHERE NOT EXISTS (SELECT 1 FROM public.checkin_migration_report WHERE label = 'etapa3b_before');

-- ============================================================
-- 1) RESPONSE = UMA OBRIGAÇÃO (estado próprio)
-- ============================================================
ALTER TABLE public.checkin_responses
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS dispatch_id uuid;

DO $$ BEGIN
  ALTER TABLE public.checkin_responses
    ADD CONSTRAINT checkin_responses_review_status_chk
    CHECK (review_status IN ('received','reviewing','reviewed','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.checkin_responses r
SET review_status = 'closed',
    reviewed_at = COALESCE(f.approved_at, f.sent_at, f.created_at),
    closed_at = COALESCE(f.sent_at, f.approved_at, f.created_at),
    closed_reason = 'legacy_feedback_sent'
FROM public.checkin_feedbacks f
WHERE f.checkin_response_id = r.id
  AND f.status = 'sent'
  AND r.review_status = 'received';

UPDATE public.checkin_responses r
SET review_status = 'reviewed',
    reviewed_at = COALESCE(f.approved_at, f.created_at)
FROM public.checkin_feedbacks f
WHERE f.checkin_response_id = r.id
  AND f.status = 'approved'
  AND r.review_status = 'received';

CREATE INDEX IF NOT EXISTS idx_checkin_responses_review_status
  ON public.checkin_responses (review_status, submitted_at DESC);

DROP POLICY IF EXISTS "Form owners can update responses" ON public.checkin_responses;
CREATE POLICY "Form owners can update responses" ON public.checkin_responses
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checkin_forms f WHERE f.id = checkin_responses.form_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.checkin_forms f WHERE f.id = checkin_responses.form_id AND f.user_id = auth.uid()));

-- ============================================================
-- 2) FEEDBACK = CICLO SEPARADO
-- ============================================================
ALTER TABLE public.checkin_feedbacks
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

DO $$ BEGIN
  ALTER TABLE public.checkin_feedbacks
    ADD CONSTRAINT checkin_feedbacks_publication_status_chk
    CHECK (publication_status IN ('draft','approved','published','not_published'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.checkin_feedbacks
SET publication_status = CASE
      WHEN status = 'sent' THEN 'published'
      WHEN status = 'approved' THEN 'approved'
      ELSE 'draft' END,
    published_at = CASE WHEN status = 'sent' THEN COALESCE(sent_at, approved_at, created_at) ELSE published_at END
WHERE publication_status = 'draft';

CREATE INDEX IF NOT EXISTS idx_checkin_feedbacks_publication
  ON public.checkin_feedbacks (client_id, publication_status);

DROP POLICY IF EXISTS "athlete reads own published feedback" ON public.checkin_feedbacks;
CREATE POLICY "athlete reads own published feedback" ON public.checkin_feedbacks
  FOR SELECT TO authenticated
  USING (
    publication_status = 'published'
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = checkin_feedbacks.client_id AND c.athlete_user_id = auth.uid())
  );

-- ============================================================
-- 3) DISPATCH = EVIDÊNCIA DA OCORRÊNCIA (+ idempotência daqui pra frente)
-- ============================================================
ALTER TABLE public.checkin_dispatches
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS occurrence_date date,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS response_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.checkin_dispatches
SET scheduled_for = COALESCE(scheduled_for, sent_at, created_at),
    response_deadline = COALESCE(response_deadline, due_at)
WHERE scheduled_for IS NULL OR response_deadline IS NULL;

CREATE OR REPLACE FUNCTION public.set_checkin_dispatch_occurrence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.scheduled_for := COALESCE(NEW.scheduled_for, NEW.sent_at, NEW.created_at, now());
  NEW.occurrence_date := (NEW.scheduled_for AT TIME ZONE 'America/Fortaleza')::date;
  NEW.response_deadline := COALESCE(NEW.response_deadline, NEW.due_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_dispatch_occurrence ON public.checkin_dispatches;
CREATE TRIGGER trg_checkin_dispatch_occurrence
  BEFORE INSERT OR UPDATE ON public.checkin_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.set_checkin_dispatch_occurrence();

UPDATE public.checkin_dispatches
SET occurrence_date = (COALESCE(scheduled_for, sent_at, created_at) AT TIME ZONE 'America/Fortaleza')::date
WHERE occurrence_date IS NULL;

-- Idempotência apenas para novas ocorrências (histórico legado preservado intacto).
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_dispatch_occurrence
  ON public.checkin_dispatches (schedule_id, occurrence_date)
  WHERE schedule_id IS NOT NULL
    AND occurrence_date >= DATE '2026-08-16'
    AND status IN ('scheduled','pending','sent');

CREATE INDEX IF NOT EXISTS idx_checkin_dispatches_client_occurrence
  ON public.checkin_dispatches (client_id, occurrence_date DESC);

-- ============================================================
-- 4) CORREÇÕES DE RESPOSTA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checkin_response_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.checkin_responses(id) ON DELETE CASCADE,
  client_id uuid,
  question_id text NOT NULL,
  question_text text,
  original_value jsonb,
  corrected_value jsonb,
  reason text,
  corrected_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.checkin_response_corrections TO authenticated;
GRANT ALL ON public.checkin_response_corrections TO service_role;
ALTER TABLE public.checkin_response_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read corrections" ON public.checkin_response_corrections;
CREATE POLICY "admins read corrections" ON public.checkin_response_corrections
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert corrections" ON public.checkin_response_corrections;
CREATE POLICY "admins insert corrections" ON public.checkin_response_corrections
  FOR INSERT TO authenticated WITH CHECK (corrected_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_checkin_corrections_response ON public.checkin_response_corrections (response_id);

-- ============================================================
-- 5) PROPOSTAS DE ALTERAÇÃO DO PLANO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_plan_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  checkin_response_id uuid REFERENCES public.checkin_responses(id) ON DELETE SET NULL,
  current_published_version_id uuid REFERENCES public.meal_plan_versions(id) ON DELETE SET NULL,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  ai_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  resulting_version_id uuid REFERENCES public.meal_plan_versions(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decided_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_change_proposals_status_chk
    CHECK (status IN ('pending','accepted','rejected','converted_to_draft'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_change_proposals TO authenticated;
GRANT ALL ON public.meal_plan_change_proposals TO service_role;
ALTER TABLE public.meal_plan_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages own plan proposals" ON public.meal_plan_change_proposals;
CREATE POLICY "admin manages own plan proposals" ON public.meal_plan_change_proposals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_meal_plan_change_proposals_updated ON public.meal_plan_change_proposals;
CREATE TRIGGER trg_meal_plan_change_proposals_updated
  BEFORE UPDATE ON public.meal_plan_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_plan_proposals_client_status
  ON public.meal_plan_change_proposals (client_id, status, created_at DESC);

-- ============================================================
-- 6) FREQUÊNCIA: DAILY REMOVIDA
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.athlete_checkin_schedules
    ADD CONSTRAINT athlete_checkin_schedules_frequency_chk
    CHECK (frequency_type IN ('weekly','biweekly','three_weeks','monthly','bimonthly','quarterly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
