
-- Remover o cron job que não funciona (pg_net não disponível)
SELECT cron.unschedule('send-reminder-15m');
