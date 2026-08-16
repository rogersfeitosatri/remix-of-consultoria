-- ETAPA 6C — Observabilidade: camada canônica de eventos operacionais no BANCO.
-- Regra: eventos de mudança de estado de entidade são gravados por trigger
-- (uma única camada responsável), independente do caller (app, edge, RPC, cron).

CREATE OR REPLACE FUNCTION public.log_operational_event(
  p_user_id uuid,
  p_client_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_source text DEFAULT 'db',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.operational_events
    (user_id, client_id, entity_type, entity_id, event_type, actor_user_id, source, metadata)
  VALUES
    (p_user_id, p_client_id, p_entity_type, p_entity_id, p_event_type, auth.uid(), p_source,
     coalesce(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- Telemetria nunca desfaz a ação principal.
  RAISE WARNING 'log_operational_event falhou: %', SQLERRM;
END;
$$;

-- ============ CLIENTS: ciclo de vida ============
CREATE OR REPLACE FUNCTION public.trg_log_client_lifecycle_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.is_frozen,false) IS DISTINCT FROM coalesce(OLD.is_frozen,false) THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.id, 'client', NEW.id,
      CASE WHEN NEW.is_frozen THEN 'client_frozen' ELSE 'client_unfrozen' END,
      'db', jsonb_build_object('frozen_at', NEW.frozen_at, 'end_date', NEW.end_date));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.id, 'client', NEW.id,
      CASE
        WHEN NEW.status = 'inactive' THEN 'client_ended'
        WHEN OLD.status = 'inactive' AND NEW.status = 'active' THEN 'client_reactivated'
        ELSE 'client_status_changed'
      END,
      'db', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_lifecycle_event ON public.clients;
CREATE TRIGGER trg_log_client_lifecycle_event
AFTER UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.trg_log_client_lifecycle_event();

-- ============ APPOINTMENTS ============
CREATE OR REPLACE FUNCTION public.trg_log_appointment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.client_id, 'appointment', NEW.id, 'appointment_scheduled',
      'db', jsonb_build_object('date', NEW.appointment_date, 'status', NEW.status));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled' THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.client_id, 'appointment', NEW.id, 'appointment_cancelled',
      'db', jsonb_build_object('date', NEW.appointment_date));
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.client_id, 'appointment', NEW.id, 'appointment_completed',
      'db', jsonb_build_object('date', NEW.appointment_date));
  ELSIF NEW.appointment_date IS DISTINCT FROM OLD.appointment_date THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.client_id, 'appointment', NEW.id, 'appointment_rescheduled',
      'db', jsonb_build_object('from', OLD.appointment_date, 'to', NEW.appointment_date));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_appointment_event ON public.appointments;
CREATE TRIGGER trg_log_appointment_event
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_log_appointment_event();

-- ============ CHECK-IN RESPONSES ============
CREATE OR REPLACE FUNCTION public.trg_log_checkin_response_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.clients WHERE id = coalesce(NEW.client_id, OLD.client_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_operational_event(
      v_owner, NEW.client_id, 'checkin_response', NEW.id, 'checkin_response_received',
      'db', jsonb_build_object('dispatch_id', NEW.dispatch_id, 'review_status', NEW.review_status));
  ELSIF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    PERFORM public.log_operational_event(
      v_owner, NEW.client_id, 'checkin_response', NEW.id, 'checkin_response_reviewed',
      'db', jsonb_build_object('from', OLD.review_status, 'to', NEW.review_status));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_checkin_response_event ON public.checkin_responses;
CREATE TRIGGER trg_log_checkin_response_event
AFTER INSERT OR UPDATE ON public.checkin_responses
FOR EACH ROW EXECUTE FUNCTION public.trg_log_checkin_response_event();

-- ============ FEEDBACK PUBLICADO ============
CREATE OR REPLACE FUNCTION public.trg_log_checkin_feedback_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF NEW.publication_status IS DISTINCT FROM OLD.publication_status
     AND NEW.publication_status = 'published' THEN
    SELECT user_id INTO v_owner FROM public.clients WHERE id = NEW.client_id;
    PERFORM public.log_operational_event(
      v_owner, NEW.client_id, 'checkin_response', NEW.checkin_response_id, 'checkin_feedback_published',
      'db', jsonb_build_object('feedback_id', NEW.id, 'published_at', NEW.published_at));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_checkin_feedback_event ON public.checkin_feedbacks;
CREATE TRIGGER trg_log_checkin_feedback_event
AFTER UPDATE ON public.checkin_feedbacks
FOR EACH ROW EXECUTE FUNCTION public.trg_log_checkin_feedback_event();

-- ============ REVISÃO NUTRICIONAL ============
CREATE OR REPLACE FUNCTION public.trg_log_nutrition_review_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.client_id, 'nutrition_review', NEW.id,
      CASE WHEN NEW.decision = 'no_change'
           THEN 'nutrition_review_completed_no_change'
           ELSE 'nutrition_review_completed_with_change' END,
      'db', jsonb_build_object('decision', NEW.decision, 'checkin_response_id', NEW.checkin_response_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_nutrition_review_event ON public.nutrition_reviews;
CREATE TRIGGER trg_log_nutrition_review_event
AFTER UPDATE ON public.nutrition_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_log_nutrition_review_event();

-- ============ ÍNDICES DE CONSULTA ============
CREATE INDEX IF NOT EXISTS idx_operational_events_user_created
  ON public.operational_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status
  ON public.ai_runs (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_prompt_version
  ON public.ai_runs (prompt_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_environment
  ON public.ai_runs (environment, created_at DESC);
