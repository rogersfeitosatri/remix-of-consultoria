
-- Function to auto-create task when anamnese is submitted
CREATE OR REPLACE FUNCTION public.auto_create_task_on_anamnese()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_admin_id UUID;
  v_due DATE;
  v_day_of_week INT;
  v_has_consultation BOOLEAN;
BEGIN
  -- Only process if client_id is set
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get client info
  SELECT c.*, c.user_id AS admin_user_id INTO v_client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only for nutrition or both service types
  IF v_client.service_type NOT IN ('nutrition', 'both') THEN
    RETURN NEW;
  END IF;

  v_admin_id := v_client.admin_user_id;

  -- Check if client has consultation scheduled
  v_has_consultation := EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.client_id = NEW.client_id
      AND a.status IN ('scheduled', 'confirmed')
      AND a.appointment_date >= CURRENT_DATE
  );

  IF v_has_consultation THEN
    -- Get the consultation date as due date
    SELECT a.appointment_date::date INTO v_due
    FROM public.appointments a
    WHERE a.client_id = NEW.client_id
      AND a.status IN ('scheduled', 'confirmed')
      AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date ASC
    LIMIT 1;
  ELSE
    -- Calculate 3 business days from now
    v_due := CURRENT_DATE;
    DECLARE days_added INT := 0;
    BEGIN
      WHILE days_added < 3 LOOP
        v_due := v_due + INTERVAL '1 day';
        IF EXTRACT(DOW FROM v_due) NOT IN (0, 6) THEN
          days_added := days_added + 1;
        END IF;
      END LOOP;
    END;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM v_due)::INT;

  -- Check if a task already exists for this client+type
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = NEW.client_id
      AND task_type = 'meal_plan'
      AND status IN ('pending', 'in_progress')
      AND user_id = v_admin_id
  ) THEN
    INSERT INTO public.tasks (
      user_id, title, description, day_of_week, due_date, 
      client_id, task_type, status, priority, source
    ) VALUES (
      v_admin_id,
      'Montar plano alimentar – ' || v_client.name,
      CASE WHEN v_has_consultation 
        THEN 'Preparar plano para consulta agendada em ' || to_char(v_due, 'DD/MM/YYYY')
        ELSE 'Anamnese recebida. Prazo: ' || to_char(v_due, 'DD/MM/YYYY')
      END,
      v_day_of_week,
      v_due,
      NEW.client_id,
      'meal_plan',
      'pending',
      CASE WHEN v_has_consultation THEN 'high' ELSE 'medium' END,
      'auto_anamnese'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on anamnese_responses
DROP TRIGGER IF EXISTS trg_auto_task_on_anamnese ON public.anamnese_responses;
CREATE TRIGGER trg_auto_task_on_anamnese
  AFTER INSERT ON public.anamnese_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_task_on_anamnese();

-- Function to auto-create task when checkin is responded
CREATE OR REPLACE FUNCTION public.auto_create_task_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_admin_id UUID;
  v_due DATE;
  v_day_of_week INT;
BEGIN
  -- Get client info
  SELECT c.*, c.user_id AS admin_user_id INTO v_client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  v_admin_id := v_client.admin_user_id;

  -- Due date: 2 business days
  v_due := CURRENT_DATE;
  DECLARE days_added INT := 0;
  BEGIN
    WHILE days_added < 2 LOOP
      v_due := v_due + INTERVAL '1 day';
      IF EXTRACT(DOW FROM v_due) NOT IN (0, 6) THEN
        days_added := days_added + 1;
      END IF;
    END LOOP;
  END;

  v_day_of_week := EXTRACT(DOW FROM v_due)::INT;

  -- Only create if no pending task for this checkin response
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = NEW.client_id
      AND task_type = 'checkin_response'
      AND status IN ('pending', 'in_progress')
      AND user_id = v_admin_id
  ) THEN
    INSERT INTO public.tasks (
      user_id, title, description, day_of_week, due_date,
      client_id, task_type, status, priority, source
    ) VALUES (
      v_admin_id,
      'Responder check-in – ' || v_client.name,
      'Check-in recebido em ' || to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      v_day_of_week,
      v_due,
      NEW.client_id,
      'checkin_response',
      'pending',
      'medium',
      'auto_checkin'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on checkin_responses
DROP TRIGGER IF EXISTS trg_auto_task_on_checkin ON public.checkin_responses;
CREATE TRIGGER trg_auto_task_on_checkin
  AFTER INSERT ON public.checkin_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_task_on_checkin();
