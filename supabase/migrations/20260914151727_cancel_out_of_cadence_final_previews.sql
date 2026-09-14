-- Final pending previews with no valid remaining cycle; no outbound effects.
CREATE TEMP TABLE final_preview_cleanup ON COMMIT DROP AS
SELECT sc.id,to_jsonb(sc) before_config
FROM public.scheduled_checkins sc
JOIN public.clients c ON c.id=sc.client_id AND c.user_id=sc.user_id
JOIN public.athlete_checkin_schedules s ON s.client_id=c.id AND s.user_id=c.user_id
WHERE c.name IN ('JOAO MESTRINHO','Isabella Barros')
AND c.checkin_frequency='monthly' AND s.is_active AND c.is_active
AND NOT c.is_frozen AND c.archived_at IS NULL AND c.ended_at IS NULL
AND sc.status='pending' AND sc.sent_at IS NULL AND sc.response_id IS NULL
AND sc.scheduled_send_date='2026-09-14'
AND c.end_date BETWEEN '2026-09-14' AND '2026-09-20'
AND mod(sc.scheduled_send_date-(coalesce(c.checkin_start_date,s.start_date)+28+
((1-extract(dow FROM coalesce(c.checkin_start_date,s.start_date)+28)::int+7)%7)),28)<>0;
INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Final preview outside cadence; outbound paused','scheduled_checkins',id,before_config FROM final_preview_cleanup;
UPDATE public.scheduled_checkins SET status='cancelled',updated_at=now(),
notes=concat_ws(' | ',nullif(notes,''),'Previsão fora da cadência e sem novo ciclo na vigência; envios pausados')
WHERE id IN (SELECT id FROM final_preview_cleanup);
