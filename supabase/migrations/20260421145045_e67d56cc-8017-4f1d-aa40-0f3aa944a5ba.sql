-- 1) Campos de auditoria
ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS triggered_by text,
  ADD COLUMN IF NOT EXISTS consultation_schedule_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_message_logs_triggered_by_check') THEN
    ALTER TABLE public.whatsapp_message_logs
      ADD CONSTRAINT whatsapp_message_logs_triggered_by_check
      CHECK (triggered_by IS NULL OR triggered_by IN (
        'cron_daily','cron_weekly_legacy','manual_admin','followup_cron','reminder_24h','reminder_15m','system'
      ));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_wamlogs_client_template_createdat
  ON public.whatsapp_message_logs (client_id, template_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wamlogs_consultation_schedule
  ON public.whatsapp_message_logs (consultation_schedule_id) WHERE consultation_schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wamlogs_blocked_reason
  ON public.whatsapp_message_logs (blocked_reason, created_at DESC) WHERE blocked_reason IS NOT NULL;

-- 2) Elegibilidade
CREATE OR REPLACE FUNCTION public.is_client_eligible_for_booking(_client_id uuid)
RETURNS TABLE(eligible boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_client RECORD; v_has_future_appt boolean; v_completed_count integer;
BEGIN
  SELECT id, is_active, is_frozen, has_consultations, consultation_count, end_date
  INTO v_client FROM public.clients WHERE id = _client_id LIMIT 1;

  IF v_client IS NULL THEN RETURN QUERY SELECT false, 'client_not_found'::text; RETURN; END IF;
  IF v_client.is_frozen IS TRUE THEN RETURN QUERY SELECT false, 'client_frozen'::text; RETURN; END IF;
  IF v_client.is_active IS NOT TRUE THEN RETURN QUERY SELECT false, 'client_inactive'::text; RETURN; END IF;
  IF v_client.has_consultations IS NOT TRUE THEN RETURN QUERY SELECT false, 'no_consultations_in_plan'::text; RETURN; END IF;
  IF v_client.end_date IS NOT NULL AND v_client.end_date < CURRENT_DATE THEN RETURN QUERY SELECT false, 'plan_expired'::text; RETURN; END IF;

  SELECT EXISTS(SELECT 1 FROM public.appointments
    WHERE client_id = _client_id AND status IN ('scheduled','confirmed') AND appointment_date >= CURRENT_DATE
  ) INTO v_has_future_appt;
  IF v_has_future_appt THEN RETURN QUERY SELECT false, 'already_scheduled'::text; RETURN; END IF;

  IF v_client.consultation_count IS NOT NULL AND v_client.consultation_count > 0 THEN
    SELECT COUNT(*) INTO v_completed_count FROM public.consultation_schedules
    WHERE client_id = _client_id AND status = 'completed';
    IF v_completed_count >= v_client.consultation_count THEN
      RETURN QUERY SELECT false, 'consultations_exhausted'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, 'eligible'::text;
END;
$$;

-- 3) Duplicate guard
CREATE OR REPLACE FUNCTION public.check_booking_send_duplicate(
  _client_id uuid, _template_key text, _consultation_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE(is_duplicate boolean, reason text, existing_log_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_window interval; v_existing_id uuid;
BEGIN
  v_window := CASE
    WHEN _template_key ILIKE '%reminder%' OR _template_key ILIKE '%confirmation%' THEN interval '24 hours'
    WHEN _template_key ILIKE '%booking%' OR _template_key ILIKE '%followup%' OR _template_key ILIKE '%agendamento%' THEN interval '7 days'
    ELSE interval '24 hours'
  END;

  IF _consultation_schedule_id IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.whatsapp_message_logs
    WHERE consultation_schedule_id = _consultation_schedule_id
      AND template_key = _template_key AND status = 'sent' AND blocked_reason IS NULL
    ORDER BY created_at DESC LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN QUERY SELECT true, 'duplicate_schedule_template'::text, v_existing_id; RETURN;
    END IF;
  END IF;

  SELECT id INTO v_existing_id FROM public.whatsapp_message_logs
  WHERE client_id = _client_id AND template_key = _template_key
    AND status = 'sent' AND blocked_reason IS NULL
    AND created_at >= (now() - v_window)
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT true, 'duplicate_window'::text, v_existing_id; RETURN;
  END IF;
  RETURN QUERY SELECT false, NULL::text, NULL::uuid;
END;
$$;

-- 4) Templates versionados (template_name é obrigatório)
INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, is_active)
SELECT ur.user_id, 'consultation_reminder_24h_v1', 'Lembrete de Consulta (24h) v1',
  'Lembrete de consulta amanhã',
  E'Olá {client_name}! 👋\n\nLembrando da sua consulta marcada para amanhã ({appointment_date}) às {appointment_time}.\n\n📍 Link da reunião: {meeting_link}\n\nNos vemos em breve! 💪',
  true
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_templates wt
    WHERE wt.user_id = ur.user_id AND wt.template_key = 'consultation_reminder_24h_v1');

INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, is_active)
SELECT ur.user_id, 'booking_followup_v1', 'Follow-up de Agendamento v1',
  'Lembrete: agende sua consulta',
  E'Oi {client_name}! 😊\n\nNotei que você ainda não escolheu um horário para sua próxima consulta. O link está esperando você:\n\n🔗 {booking_link}\n\nQualquer dúvida, é só chamar!',
  true
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_templates wt
    WHERE wt.user_id = ur.user_id AND wt.template_key = 'booking_followup_v1');