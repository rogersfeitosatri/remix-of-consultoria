CREATE OR REPLACE FUNCTION public.update_consultation_journey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_cadence_weeks integer;
  v_completed_count integer;
  v_next_consult_date date;
  v_next_send_date date;
  v_has_pending_future boolean;
BEGIN
  -- Apenas reage a status agendados/confirmados
  IF NEW.status NOT IN ('confirmed', 'scheduled') THEN
    RETURN NEW;
  END IF;

  SELECT id, consultation_frequency, end_date, has_consultations, consultation_count, user_id
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atualiza first_consultation_date se necessário
  IF v_client.has_consultations = true THEN
    UPDATE public.clients
    SET first_consultation_date = COALESCE(first_consultation_date, NEW.appointment_date)
    WHERE id = NEW.client_id;
  END IF;

  -- Se atleta não tem consultas no plano, não projeta nada
  IF v_client.has_consultations IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_cadence_weeks := CASE
    WHEN v_client.consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN v_client.consultation_frequency IN ('monthly', '4_weeks') THEN 4
    ELSE 4
  END;

  -- Conta consultas já completadas/agendadas em consultation_schedules
  SELECT COUNT(*) INTO v_completed_count
  FROM public.consultation_schedules
  WHERE client_id = NEW.client_id
    AND status IN ('completed', 'scheduled');

  -- Se plano tem limite e já atingiu, não cria próximo
  IF v_client.consultation_count IS NOT NULL
     AND v_client.consultation_count > 0
     AND v_completed_count >= v_client.consultation_count THEN
    RETURN NEW;
  END IF;

  -- Calcula próxima data de consulta (cadência a partir desta consulta)
  v_next_consult_date := (NEW.appointment_date + (v_cadence_weeks * INTERVAL '1 week'))::date;

  -- Se ultrapassa fim do plano, não projeta
  IF v_client.end_date IS NOT NULL AND v_next_consult_date > v_client.end_date THEN
    RETURN NEW;
  END IF;

  -- Data de envio do link: segunda-feira da semana anterior à consulta
  v_next_send_date := (v_next_consult_date - ((EXTRACT(DOW FROM v_next_consult_date)::int + 6) % 7 + 7) * INTERVAL '1 day')::date;

  -- Verifica se já existe um schedule pendente futuro (evita duplicação)
  SELECT EXISTS(
    SELECT 1 FROM public.consultation_schedules
    WHERE client_id = NEW.client_id
      AND status = 'pending'
      AND scheduled_date >= NEW.appointment_date
  ) INTO v_has_pending_future;

  IF NOT v_has_pending_future THEN
    INSERT INTO public.consultation_schedules (
      client_id, user_id, scheduled_date, send_link_date, status
    ) VALUES (
      NEW.client_id, v_client.user_id, v_next_consult_date, v_next_send_date, 'pending'
    );
  END IF;

  RETURN NEW;
END;
$function$;