-- ============================================================
-- Sincronização do Pipeline a partir da 1ª Consulta Agendada
-- ============================================================
-- Permite cadastrar atleta SEM data da 1ª consulta. Quando o
-- atleta agenda a 1ª pelo link de booking, o sistema gera todas
-- as consultas restantes do plano respeitando a periodicidade.

-- ------------------------------------------------------------
-- 1) Função: bootstrap_pipeline_from_first_appointment
-- ------------------------------------------------------------
-- Ao inserir/atualizar um appointment confirmed/scheduled,
-- se o cliente ainda NÃO tem first_consultation_date, define-a
-- e gera todas as consultas restantes do plano no pipeline.
CREATE OR REPLACE FUNCTION public.bootstrap_pipeline_from_first_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_cadence_weeks integer;
  v_total integer;
  v_remaining integer;
  v_existing_pending integer;
  v_existing_completed integer;
  v_next_date date;
  v_send_date date;
  v_i integer;
  v_first_schedule_id uuid;
BEGIN
  -- Apenas para appointments válidos
  IF NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Carrega dados do cliente
  SELECT id, user_id, has_consultations, consultation_frequency, consultation_count,
         end_date, first_consultation_date
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client IS NULL OR v_client.has_consultations IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Se já existe first_consultation_date, deixa para os outros triggers
  -- (link_appointment_to_schedule e update_consultation_journey)
  IF v_client.first_consultation_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Cadência (semanas)
  v_cadence_weeks := CASE
    WHEN v_client.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN v_client.consultation_frequency IN ('monthly', '4_weeks') THEN 4
    WHEN v_client.consultation_frequency = 'weekly' THEN 1
    WHEN v_client.consultation_frequency = 'biweekly' THEN 2
    ELSE 4
  END;

  -- Define first_consultation_date com a data deste appointment
  UPDATE public.clients
  SET first_consultation_date = NEW.appointment_date,
      updated_at = now()
  WHERE id = NEW.client_id;

  -- Conta o que já existe no pipeline (evita duplicar em cenários edge)
  SELECT COUNT(*) FILTER (WHERE status IN ('completed', 'scheduled')),
         COUNT(*) FILTER (WHERE status = 'pending')
    INTO v_existing_completed, v_existing_pending
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id;

  -- Limpa pendings antigos (vamos regerar com base nesta nova âncora)
  DELETE FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status = 'pending';

  -- Insere a 1ª consulta no schedule (já como 'scheduled', linkando ao appointment)
  v_send_date := (NEW.appointment_date - ((EXTRACT(DOW FROM NEW.appointment_date)::int + 6) % 7 + 7) * INTERVAL '1 day')::date;

  INSERT INTO public.consultation_schedules (
    client_id, user_id, scheduled_date, scheduled_time, send_link_date,
    status, appointment_id
  ) VALUES (
    NEW.client_id, v_client.user_id, NEW.appointment_date, NEW.appointment_time,
    v_send_date, 'scheduled', NEW.id
  )
  RETURNING id INTO v_first_schedule_id;

  -- Calcula quantas restantes projetar
  v_total := COALESCE(v_client.consultation_count, 0);
  IF v_total <= 0 THEN
    -- Plano "ilimitado" (premium): cap de segurança 24, projeta até end_date
    v_remaining := 24;
  ELSE
    -- Já contamos a 1ª recém-criada
    v_remaining := v_total - 1 - v_existing_completed;
  END IF;

  IF v_remaining <= 0 THEN
    RETURN NEW;
  END IF;

  -- Projeta as próximas consultas
  v_next_date := NEW.appointment_date;
  v_i := 0;
  WHILE v_i < v_remaining LOOP
    v_next_date := (v_next_date + (v_cadence_weeks * INTERVAL '1 week'))::date;

    -- Para se passar do fim do plano
    EXIT WHEN v_client.end_date IS NOT NULL AND v_next_date > v_client.end_date;

    v_send_date := (v_next_date - ((EXTRACT(DOW FROM v_next_date)::int + 6) % 7 + 7) * INTERVAL '1 day')::date;

    INSERT INTO public.consultation_schedules (
      client_id, user_id, scheduled_date, send_link_date, status
    ) VALUES (
      NEW.client_id, v_client.user_id, v_next_date, v_send_date, 'pending'
    );

    v_i := v_i + 1;
  END LOOP;

  -- Atualiza remaining_consultations
  IF v_total > 0 THEN
    UPDATE public.clients
    SET remaining_consultations = GREATEST(v_total - v_existing_completed - 1, 0)
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 2) Trigger: bootstrap_pipeline na criação de appointment
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bootstrap_pipeline_from_first_appointment ON public.appointments;
CREATE TRIGGER trg_bootstrap_pipeline_from_first_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_pipeline_from_first_appointment();

-- ------------------------------------------------------------
-- 3) Triggers de sincronização (todos AFTER em appointments)
-- ------------------------------------------------------------

-- Linka appointment a schedule pendente quando inserido
-- (somente se NÃO foi o bootstrap acima - bootstrap já cria o schedule linkado)
DROP TRIGGER IF EXISTS trg_link_appointment_to_schedule ON public.appointments;
CREATE TRIGGER trg_link_appointment_to_schedule
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.link_appointment_to_schedule();

-- Sincroniza schedule quando appointment muda (cancel, reschedule, complete)
DROP TRIGGER IF EXISTS trg_sync_schedule_on_appointment_change ON public.appointments;
CREATE TRIGGER trg_sync_schedule_on_appointment_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_schedule_on_appointment_change();

-- Projeta próxima consulta automaticamente quando uma é agendada
-- (incremental, complementar ao bootstrap)
DROP TRIGGER IF EXISTS trg_update_consultation_journey ON public.appointments;
CREATE TRIGGER trg_update_consultation_journey
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_consultation_journey();

-- ------------------------------------------------------------
-- 4) Triggers em consultation_schedules
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_remaining_on_schedule_complete ON public.consultation_schedules;
CREATE TRIGGER trg_sync_remaining_on_schedule_complete
  AFTER UPDATE ON public.consultation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_remaining_on_schedule_complete();

DROP TRIGGER IF EXISTS trg_mark_plan_completed ON public.consultation_schedules;
CREATE TRIGGER trg_mark_plan_completed
  AFTER UPDATE ON public.consultation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_plan_completed();

-- ------------------------------------------------------------
-- 5) Trigger em clients para regenerar pipeline ao mudar plano
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_pipeline_on_plan_change ON public.clients;
CREATE TRIGGER trg_sync_pipeline_on_plan_change
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pipeline_on_plan_change();

-- ------------------------------------------------------------
-- 6) Comentário documental
-- ------------------------------------------------------------
COMMENT ON FUNCTION public.bootstrap_pipeline_from_first_appointment() IS
  'Quando o atleta agenda a 1ª consulta (sem first_consultation_date prévia), define a data da 1ª consulta e gera todas as consultas restantes do plano respeitando a cadência (4 ou 6 semanas) e o end_date.';