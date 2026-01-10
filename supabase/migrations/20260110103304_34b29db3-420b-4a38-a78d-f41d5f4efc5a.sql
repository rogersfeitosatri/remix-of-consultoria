-- ===========================================
-- 1. EXPANDIR consultation_schedule_rules PARA JORNADA COMPLETA
-- ===========================================

-- Adicionar campos para gerenciamento da jornada de consultas
ALTER TABLE public.consultation_schedule_rules 
ADD COLUMN IF NOT EXISTS first_consultation_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_link_send_date date,
ADD COLUMN IF NOT EXISTS next_link_send_time time DEFAULT '07:00:00'::time,
ADD COLUMN IF NOT EXISTS consultations_completed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_link_sent_at timestamp with time zone;

-- Adicionar índice para buscas por data de envio
CREATE INDEX IF NOT EXISTS idx_consultation_schedule_rules_next_send 
ON public.consultation_schedule_rules (next_link_send_date) 
WHERE is_enabled = true AND next_link_send_date IS NOT NULL;

-- ===========================================
-- 2. CRIAR FUNÇÃO PARA ENVIO AUTOMÁTICO DE LINKS
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_pending_booking_invites()
RETURNS TABLE (
  client_id uuid,
  client_name text,
  client_phone text,
  admin_user_id uuid,
  cadence_weeks integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    csr.client_id,
    c.name AS client_name,
    c.phone AS client_phone,
    c.user_id AS admin_user_id,
    csr.cadence_weeks
  FROM public.consultation_schedule_rules csr
  JOIN public.clients c ON c.id = csr.client_id
  WHERE csr.is_enabled = true
    AND csr.next_link_send_date IS NOT NULL
    AND csr.next_link_send_date <= CURRENT_DATE
    AND (
      -- Verifica se não foi enviado hoje ainda
      csr.last_link_sent_at IS NULL 
      OR csr.last_link_sent_at::date < CURRENT_DATE
    )
    AND c.is_active = true
    AND (c.has_consultations = true OR c.has_agenda_access = true)
    -- Verifica se está dentro do período do plano (respeitando limite de última consulta)
    AND c.end_date > CURRENT_DATE + (csr.cadence_weeks * INTERVAL '1 week');
$$;

-- ===========================================
-- 3. FUNÇÃO PARA CALCULAR PRÓXIMA DATA DE ENVIO
-- ===========================================

CREATE OR REPLACE FUNCTION public.calculate_next_booking_send_date(
  p_last_appointment_at timestamp with time zone,
  p_cadence_weeks integer
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_next_date date;
BEGIN
  -- Calcula a próxima data baseada na última consulta + cadência
  v_next_date := (p_last_appointment_at + (p_cadence_weeks * INTERVAL '1 week'))::date;
  
  -- Ajusta para a próxima segunda-feira
  -- EXTRACT(DOW) retorna 0 = domingo, 1 = segunda, etc.
  WHILE EXTRACT(DOW FROM v_next_date) != 1 LOOP
    v_next_date := v_next_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN v_next_date;
END;
$$;

-- ===========================================
-- 4. TRIGGER PARA ATUALIZAR JORNADA APÓS AGENDAMENTO
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_consultation_journey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_record RECORD;
  v_cadence_weeks integer;
  v_next_send_date date;
BEGIN
  -- Só processa se o agendamento foi confirmado
  IF NEW.status IN ('confirmed', 'scheduled') THEN
    -- Busca informações do cliente
    SELECT c.consultation_frequency, c.end_date, c.has_consultations
    INTO v_client_record
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Determina a cadência em semanas
    v_cadence_weeks := CASE 
      WHEN v_client_record.consultation_frequency = '6_weeks' THEN 6
      WHEN v_client_record.consultation_frequency = '4_weeks' THEN 4
      ELSE 4 -- Default
    END;
    
    -- Calcula próxima data de envio
    v_next_send_date := public.calculate_next_booking_send_date(
      (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      v_cadence_weeks
    );
    
    -- Atualiza ou cria regra de agendamento
    INSERT INTO public.consultation_schedule_rules (
      client_id,
      cadence_weeks,
      is_enabled,
      first_consultation_at,
      last_appointment_at,
      next_link_send_date,
      consultations_completed
    ) VALUES (
      NEW.client_id,
      v_cadence_weeks,
      true,
      COALESCE(
        (SELECT first_consultation_at FROM public.consultation_schedule_rules WHERE client_id = NEW.client_id),
        (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone
      ),
      (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      v_next_send_date,
      COALESCE(
        (SELECT consultations_completed FROM public.consultation_schedule_rules WHERE client_id = NEW.client_id),
        0
      ) + 1
    )
    ON CONFLICT (client_id) DO UPDATE SET
      cadence_weeks = v_cadence_weeks,
      last_appointment_at = (NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp with time zone,
      next_link_send_date = CASE 
        -- Só agenda próximo envio se ainda está dentro do plano
        WHEN v_client_record.end_date > (CURRENT_DATE + (v_cadence_weeks * INTERVAL '1 week')::interval)
        THEN v_next_send_date
        ELSE NULL
      END,
      consultations_completed = COALESCE(consultation_schedule_rules.consultations_completed, 0) + 1,
      updated_at = now();
    
    -- Atualiza data da primeira consulta no cliente se ainda não tiver
    IF v_client_record.has_consultations = true THEN
      UPDATE public.clients
      SET first_consultation_date = COALESCE(first_consultation_date, NEW.appointment_date)
      WHERE id = NEW.client_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela appointments
DROP TRIGGER IF EXISTS trigger_update_consultation_journey ON public.appointments;
CREATE TRIGGER trigger_update_consultation_journey
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_consultation_journey();

-- ===========================================
-- 5. HABILITAR pg_cron E CRIAR JOB DE ENVIO AUTOMÁTICO
-- ===========================================

-- Habilitar extensão pg_cron (se ainda não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job para rodar toda segunda-feira às 10:00 UTC (07:00 BRT)
-- O job apenas marca os registros para envio; a edge function será chamada separadamente
SELECT cron.schedule(
  'send-weekly-booking-links',
  '0 10 * * 1', -- Segunda às 10:00 UTC = 07:00 BRT
  $$
    -- Marca registros pendentes para processamento
    UPDATE public.consultation_schedule_rules
    SET updated_at = now()
    WHERE is_enabled = true
      AND next_link_send_date IS NOT NULL
      AND next_link_send_date <= CURRENT_DATE
      AND (last_link_sent_at IS NULL OR last_link_sent_at::date < CURRENT_DATE);
  $$
);