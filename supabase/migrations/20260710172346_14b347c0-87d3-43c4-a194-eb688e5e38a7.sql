
ALTER TABLE public.zn_athletes
  ADD COLUMN IF NOT EXISTS plan_choice text,
  ADD COLUMN IF NOT EXISTS body_goal text,
  ADD COLUMN IF NOT EXISTS target_race text,
  ADD COLUMN IF NOT EXISTS target_race_date date,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_link text;

-- Amplia domínio de status para incluir 'lead'
ALTER TABLE public.zn_athletes
  DROP CONSTRAINT IF EXISTS zn_athletes_status_check;

ALTER TABLE public.zn_athletes
  ADD CONSTRAINT zn_athletes_status_check
  CHECK (status IN ('pending','active','inactive','lead'));

-- Função para promover pending -> lead após 7 dias sem pagamento
CREATE OR REPLACE FUNCTION public.zn_promote_pending_to_lead()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.zn_athletes
     SET status = 'lead',
         lead_marked_at = now()
   WHERE status = 'pending'
     AND first_payment_at IS NULL
     AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Cron diário 03:00 America/Fortaleza (06:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('zn-promote-pending-to-lead-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zn-promote-pending-to-lead-daily');
    PERFORM cron.schedule(
      'zn-promote-pending-to-lead-daily',
      '0 6 * * *',
      $cron$SELECT public.zn_promote_pending_to_lead();$cron$
    );
  END IF;
END $$;
