
-- Criar cron job para enviar lembretes de check-in (roda a cada 5 minutos)
SELECT cron.schedule(
  'send-checkin-reminders',
  '*/5 * * * *',
  $$
  SELECT extensions.http(
    (
      'POST',
      'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/send-checkin-reminders',
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoenhuYXRnd3JhdmlkdmJlaHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTQ3NjMsImV4cCI6MjA4MzI5MDc2M30.yfr0oLbb7IRYPmt-x0rcwh5AfMWeaLjmwwj0EMRzS-8')
      ],
      'application/json',
      '{}'
    )::extensions.http_request
  );
  $$
);
