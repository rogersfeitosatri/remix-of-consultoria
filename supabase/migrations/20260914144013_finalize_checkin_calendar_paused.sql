-- No cron, messages, provider calls, or real dispatches are created here.
-- Keep a reservation even after response/failure: uncertain outcomes require manual review.
CREATE UNIQUE INDEX IF NOT EXISTS uq_managed_checkin_cycle
ON public.checkin_dispatches(user_id,client_id,occurrence_date)
WHERE metadata->>'managed_checkin_flow'='true';

CREATE OR REPLACE FUNCTION public.reconcile_scheduled_checkins()
RETURNS TABLE(reconciled integer) LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 WITH upd AS (
  UPDATE public.scheduled_checkins sc SET status='sent',sent_at=d.sent_at,updated_at=now()
  FROM public.checkin_dispatches d
  WHERE sc.user_id=d.user_id AND sc.client_id=d.client_id
    AND sc.scheduled_send_date=d.occurrence_date
    AND sc.status='pending' AND d.status='sent' AND d.sent_at IS NOT NULL
    AND (auth.uid()=sc.user_id OR current_user IN ('service_role','postgres'))
  RETURNING sc.id
 ) SELECT count(*)::integer INTO v_count FROM upd;
 RETURN QUERY SELECT v_count;
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_scheduled_checkins() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_scheduled_checkins() TO authenticated,service_role;

-- Use a temporary plan, not dispatch records. Preserve all intentional cancellations/history.
CREATE TEMP TABLE checkin_calendar_plan ON COMMIT DROP AS
WITH eligible AS (
 SELECT c.id client_id,c.user_id,c.end_date,s.checkin_form_id form_id,s.send_time,
 coalesce(c.checkin_start_date,s.start_date) anchor,
 CASE c.checkin_frequency WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 WHEN 'monthly' THEN 28 END step,
 c.checkin_frequency
 FROM public.clients c JOIN public.athlete_checkin_schedules s ON s.client_id=c.id AND s.user_id=c.user_id
 WHERE c.user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND s.is_active
 AND c.is_active AND NOT c.is_frozen AND c.archived_at IS NULL AND c.ended_at IS NULL AND c.has_checkin
 AND c.end_date>='2026-09-14'
 AND c.id NOT IN ('24fb6e32-b1e1-4101-9943-d3fcff32e5c9','5f718610-e763-43bf-8b29-918232a2e7b6')
), first_day AS (
 SELECT *,anchor+CASE WHEN checkin_frequency='weekly' THEN 0 ELSE step END first_date FROM eligible WHERE step IS NOT NULL
), mondays AS (
 SELECT *,first_date+((1-extract(dow from first_date)::int+7)%7) first_monday FROM first_day
)
SELECT DISTINCT client_id,user_id,form_id,send_time,first_monday+n*step scheduled_date
FROM mondays CROSS JOIN generate_series(0,1000) n
WHERE first_monday+n*step BETWEEN '2026-09-14'::date AND least(end_date,'2027-09-14'::date);

INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Calendar cadence alignment; outbound paused','scheduled_checkins',sc.id,to_jsonb(sc)
FROM public.scheduled_checkins sc
WHERE sc.user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND sc.status='pending'
AND sc.scheduled_send_date>='2026-09-14' AND sc.response_id IS NULL AND sc.sent_at IS NULL
AND EXISTS(SELECT 1 FROM checkin_calendar_plan p WHERE p.client_id=sc.client_id)
AND NOT EXISTS(SELECT 1 FROM checkin_calendar_plan p WHERE p.client_id=sc.client_id AND p.scheduled_date=sc.scheduled_send_date);

UPDATE public.scheduled_checkins sc SET status='cancelled',updated_at=now(),
 notes=concat_ws(' | ',nullif(sc.notes,''),'Alinhamento de cadência em 14/09; envios pausados')
WHERE EXISTS(SELECT 1 FROM public.checkin_configuration_changes a
 WHERE a.row_id=sc.id AND a.reason='Calendar cadence alignment; outbound paused');

INSERT INTO public.scheduled_checkins(client_id,user_id,form_id,scheduled_send_date,scheduled_send_time,status,notes)
SELECT p.client_id,p.user_id,p.form_id,p.scheduled_date,p.send_time,'pending','Cadência alinhada em 14/09; envios pausados'
FROM checkin_calendar_plan p
WHERE NOT EXISTS(SELECT 1 FROM public.scheduled_checkins sc WHERE sc.client_id=p.client_id AND sc.scheduled_send_date=p.scheduled_date)
AND NOT EXISTS(SELECT 1 FROM public.checkin_dispatches d WHERE d.client_id=p.client_id AND d.occurrence_date=p.scheduled_date);
