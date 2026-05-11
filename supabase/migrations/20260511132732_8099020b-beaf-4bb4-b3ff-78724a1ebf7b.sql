
-- 1) Reconciliation function: mark scheduled_checkins as sent when a dispatch exists
CREATE OR REPLACE FUNCTION public.reconcile_scheduled_checkins()
RETURNS TABLE(reconciled int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.scheduled_checkins sc
    SET status = 'sent',
        sent_at = COALESCE(sc.sent_at, d.sent_at),
        updated_at = now()
    FROM public.checkin_dispatches d
    WHERE sc.status = 'pending'
      AND d.client_id = sc.client_id
      AND d.status = 'sent'
      AND d.sent_at::date BETWEEN (sc.scheduled_send_date - INTERVAL '2 days')::date
                              AND (sc.scheduled_send_date + INTERVAL '7 days')::date
    RETURNING sc.id
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN QUERY SELECT v_count;
END;
$$;

-- 2) Cancel overdue scheduled_checkins for inactive/frozen athletes
CREATE OR REPLACE FUNCTION public.cancel_overdue_inactive_scheduled_checkins()
RETURNS TABLE(cancelled int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.scheduled_checkins sc
    SET status = 'cancelled',
        notes = COALESCE(sc.notes,'') ||
                CASE WHEN sc.notes IS NULL OR sc.notes = '' THEN '' ELSE ' | ' END
                || 'auto-cancelled: cliente inativo/congelado',
        updated_at = now()
    FROM public.clients c
    WHERE sc.client_id = c.id
      AND sc.status = 'pending'
      AND sc.scheduled_send_date < CURRENT_DATE
      AND (c.is_active = false OR c.is_frozen = true)
    RETURNING sc.id
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN QUERY SELECT v_count;
END;
$$;

-- 3) Trigger: when a dispatch is marked sent, sync scheduled_checkins
CREATE OR REPLACE FUNCTION public.sync_scheduled_checkin_on_dispatch_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    UPDATE public.scheduled_checkins sc
    SET status = 'sent',
        sent_at = COALESCE(sc.sent_at, NEW.sent_at, now()),
        updated_at = now()
    WHERE sc.client_id = NEW.client_id
      AND sc.status = 'pending'
      AND NEW.sent_at::date BETWEEN (sc.scheduled_send_date - INTERVAL '2 days')::date
                                AND (sc.scheduled_send_date + INTERVAL '7 days')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_scheduled_checkin_on_dispatch_sent ON public.checkin_dispatches;
CREATE TRIGGER trg_sync_scheduled_checkin_on_dispatch_sent
AFTER INSERT OR UPDATE OF status ON public.checkin_dispatches
FOR EACH ROW
EXECUTE FUNCTION public.sync_scheduled_checkin_on_dispatch_sent();

-- 4) Run reconciliation + cancel now
SELECT public.reconcile_scheduled_checkins();
SELECT public.cancel_overdue_inactive_scheduled_checkins();
