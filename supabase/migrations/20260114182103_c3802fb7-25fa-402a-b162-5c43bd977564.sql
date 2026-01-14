
-- Criar função para ser chamada pelo cron (sem pg_net)
-- Esta função marca os appointments que precisam de lembrete
-- A edge function será chamada via webhook externo ou manualmente

CREATE OR REPLACE FUNCTION public.mark_pending_reminders()
RETURNS TABLE(
  appointment_id uuid,
  client_name text,
  client_phone text,
  appointment_date date,
  appointment_time time,
  google_meet_link text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as appointment_id,
    c.name as client_name,
    c.phone as client_phone,
    a.appointment_date,
    a.appointment_time,
    a.google_meet_link
  FROM public.appointments a
  JOIN public.clients c ON c.id = a.client_id
  WHERE a.status = 'confirmed'
    AND a.reminder_15m_sent_at IS NULL
    AND a.google_meet_link IS NOT NULL
    -- Consulta é nos próximos 14-16 minutos
    AND (a.appointment_date || ' ' || a.appointment_time)::timestamp 
        BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo' + interval '14 minutes')
        AND (now() AT TIME ZONE 'America/Sao_Paulo' + interval '16 minutes');
$$;
