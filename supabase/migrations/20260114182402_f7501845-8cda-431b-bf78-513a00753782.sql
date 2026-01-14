
-- Criar cron job para lembretes de 15 min usando a extensão http (que funciona)
SELECT cron.schedule(
  'send-reminder-15m',
  '* * * * *',  -- A cada minuto para não perder janela de 15 min
  $$
  SELECT extensions.http(
    (
      'POST',
      'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/send-reminder-15m',
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
