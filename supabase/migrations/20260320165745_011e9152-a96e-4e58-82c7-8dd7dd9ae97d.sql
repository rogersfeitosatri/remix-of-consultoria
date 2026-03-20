CREATE OR REPLACE FUNCTION public.auto_create_task_on_anamnese()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_admin_id UUID;
  v_due DATE;
  v_day_of_week INT;
  v_has_consultation BOOLEAN;
  days_added INT := 0;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.*, c.user_id AS admin_user_id INTO v_client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_client.service_type NOT IN ('nutrition', 'both') THEN
    RETURN NEW;
  END IF;

  v_admin_id := v_client.admin_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.client_id = NEW.client_id
      AND a.status IN ('scheduled', 'confirmed')
      AND a.appointment_date >= CURRENT_DATE
  ) INTO v_has_consultation;

  IF v_has_consultation THEN
    SELECT a.appointment_date::date INTO v_due
    FROM public.appointments a
    WHERE a.client_id = NEW.client_id
      AND a.status IN ('scheduled', 'confirmed')
      AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date ASC
    LIMIT 1;
  ELSE
    v_due := CURRENT_DATE;
    WHILE days_added < 3 LOOP
      v_due := (v_due + INTERVAL '1 day')::date;
      IF EXTRACT(DOW FROM v_due) NOT IN (0, 6) THEN
        days_added := days_added + 1;
      END IF;
    END LOOP;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM v_due)::INT;

  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = NEW.client_id
      AND task_type = 'meal_plan'::public.task_type
      AND status IN ('pending'::public.task_status, 'in_progress'::public.task_status)
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
      'meal_plan'::public.task_type,
      'pending'::public.task_status,
      (CASE WHEN v_has_consultation THEN 'high' ELSE 'medium' END)::public.task_priority,
      'auto_anamnese'::public.task_source
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_task_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_admin_id UUID;
  v_due DATE;
  v_day_of_week INT;
  days_added INT := 0;
BEGIN
  SELECT c.*, c.user_id AS admin_user_id INTO v_client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  v_admin_id := v_client.admin_user_id;
  v_due := CURRENT_DATE;

  WHILE days_added < 2 LOOP
    v_due := (v_due + INTERVAL '1 day')::date;
    IF EXTRACT(DOW FROM v_due) NOT IN (0, 6) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;

  v_day_of_week := EXTRACT(DOW FROM v_due)::INT;

  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = NEW.client_id
      AND task_type = 'checkin_response'::public.task_type
      AND status IN ('pending'::public.task_status, 'in_progress'::public.task_status)
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
      'checkin_response'::public.task_type,
      'pending'::public.task_status,
      'medium'::public.task_priority,
      'auto_checkin'::public.task_source
    );
  END IF;

  RETURN NEW;
END;
$function$;