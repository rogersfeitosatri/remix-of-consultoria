-- Bloco A: Status pending_plan / plan_completed + triggers de transição

-- 1) Trigger: ao salvar plano com consultas/check-in configurados, flip pending_plan -> active
CREATE OR REPLACE FUNCTION public.flip_status_on_plan_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.athlete_status, '') = 'pending_plan'
     AND (NEW.has_consultations = true OR NEW.has_checkin = true)
     AND COALESCE(NEW.consultation_count, 0) >= 0
     AND NEW.plan_type IS NOT NULL
     AND NEW.start_date IS NOT NULL
  THEN
    NEW.athlete_status := 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flip_status_on_plan_setup ON public.clients;
CREATE TRIGGER trg_flip_status_on_plan_setup
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.flip_status_on_plan_setup();

-- 2) Trigger: ao completar todas as consultas, marcar plan_completed
CREATE OR REPLACE FUNCTION public.mark_plan_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_done int;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') != 'completed' THEN
    SELECT consultation_count INTO v_total
    FROM public.clients
    WHERE id = NEW.client_id;

    IF v_total IS NOT NULL AND v_total > 0 THEN
      SELECT COUNT(*) INTO v_done
      FROM public.consultation_schedules
      WHERE client_id = NEW.client_id
        AND status = 'completed';

      IF v_done >= v_total THEN
        UPDATE public.clients
        SET athlete_status = 'plan_completed'
        WHERE id = NEW.client_id
          AND COALESCE(athlete_status, '') NOT IN ('plan_completed', 'frozen', 'inactive');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_plan_completed ON public.consultation_schedules;
CREATE TRIGGER trg_mark_plan_completed
AFTER UPDATE ON public.consultation_schedules
FOR EACH ROW
EXECUTE FUNCTION public.mark_plan_completed();

-- 3) Index para acelerar fila "Aguardando configuração"
CREATE INDEX IF NOT EXISTS idx_clients_athlete_status
ON public.clients(athlete_status)
WHERE athlete_status IN ('pending_plan', 'plan_completed');