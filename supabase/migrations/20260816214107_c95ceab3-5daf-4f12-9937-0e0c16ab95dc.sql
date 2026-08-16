-- ETAPA 6: remover cron duplicado de follow-up de agendamento.
-- Existiam dois jobs idênticos (send-booking-followup diário 12:00 UTC),
-- criando risco de mensagem duplicada. Mantemos apenas 'send-booking-followup'.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-followup-daily')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-followup') THEN
    PERFORM cron.unschedule('send-booking-followup-daily');
  END IF;
END $$;