-- ETAPA 6A — crons passam a se autenticar com segredo interno (x-internal-secret).
INSERT INTO private.internal_secrets(name, value)
VALUES ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoenhuYXRnd3JhdmlkdmJlaHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTQ3NjMsImV4cCI6MjA4MzI5MDc2M30.yfr0oLbb7IRYPmt-x0rcwh5AfMWeaLjmwwj0EMRzS-8')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION private.edge_headers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (SELECT value FROM private.internal_secrets WHERE name = 'anon_key'),
    'Authorization', 'Bearer ' || (SELECT value FROM private.internal_secrets WHERE name = 'anon_key'),
    'x-internal-secret', (SELECT value FROM private.internal_secrets WHERE name = 'cron_secret')
  );
$$;
REVOKE ALL ON FUNCTION private.edge_headers() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.edge_headers() FROM anon, authenticated;

DO $do$
DECLARE
  r record;
  v_base text := 'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/';
  v_map jsonb := jsonb_build_object(
    'send-reminder-15m',                  '{}',
    'process-consultation-schedules-daily','{}',
    'send-call-booking-reminders',        '{}',
    'auto-inactivate-expired-clients',    '{}',
    'process-checkin-dispatches-daily',   '{"source":"cron"}',
    'send-consultation-reminder-24h',     '{"source":"cron_reminder_24h"}',
    'send-booking-followup',              '{}',
    'admin-weekly-summary-mon-12brt',     '{}',
    'admin-eod-confirmation-20brt',       '{}',
    'np-send-race-prep-whatsapp-daily',   '{}',
    'send-task-reminders-every-minute',   '{}',
    'ajustes-mensais',                    '{}',
    'zn-sync-retry-every-minute',         '{}'
  );
  v_fn jsonb := jsonb_build_object(
    'send-reminder-15m',                  'send-reminder-15m',
    'process-consultation-schedules-daily','process-consultation-schedules',
    'send-call-booking-reminders',        'send-call-booking-reminders',
    'auto-inactivate-expired-clients',    'auto-inactivate-expired',
    'process-checkin-dispatches-daily',   'process-checkin-dispatches',
    'send-consultation-reminder-24h',     'send-consultation-reminder',
    'send-booking-followup',              'send-booking-followup',
    'admin-weekly-summary-mon-12brt',     'send-admin-weekly-summary',
    'admin-eod-confirmation-20brt',       'send-admin-eod-confirmation',
    'np-send-race-prep-whatsapp-daily',   'send-race-prep-whatsapp',
    'send-task-reminders-every-minute',   'send-task-reminders',
    'ajustes-mensais',                    'send-adjustment-notifications',
    'zn-sync-retry-every-minute',         'zn-sync-retry'
  );
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE jobname IN (SELECT jsonb_object_keys(v_map))
  LOOP
    PERFORM cron.alter_job(
      r.jobid,
      command => format(
        'SELECT net.http_post(url := %L, headers := private.edge_headers(), body := %L::jsonb);',
        v_base || (v_fn ->> r.jobname),
        (v_map ->> r.jobname)
      )
    );
  END LOOP;
END
$do$;