-- No outbound messages or real-athlete dispatches are created by this migration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_response_dispatch
ON public.checkin_responses(dispatch_id) WHERE dispatch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.commit_public_checkin_response(
 p_dispatch_id uuid, p_form_version_id uuid, p_responses jsonb, p_questions_snapshot jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE d public.checkin_dispatches%ROWTYPE; c public.clients%ROWTYPE; v_response uuid; v_deadline timestamptz;
BEGIN
 IF current_user <> 'service_role' AND current_user <> 'postgres' THEN
   RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.checkin_dispatches WHERE id=p_dispatch_id FOR UPDATE;
 IF NOT FOUND OR d.status NOT IN ('sent','responded') THEN RETURN jsonb_build_object('error','INVALID_LINK'); END IF;
 IF EXISTS(SELECT 1 FROM public.checkin_responses WHERE dispatch_id=d.id) OR d.status='responded' THEN
  RETURN jsonb_build_object('error','ALREADY_SUBMITTED');
 END IF;
 SELECT * INTO c FROM public.clients WHERE id=d.client_id FOR SHARE;
 IF NOT FOUND OR c.user_id<>d.user_id OR NOT c.is_active OR c.is_frozen IS TRUE OR c.archived_at IS NOT NULL
 OR c.ended_at IS NOT NULL OR NOT c.has_checkin OR c.end_date < (now() AT TIME ZONE 'America/Fortaleza')::date THEN
  RETURN jsonb_build_object('error','NOT_ELIGIBLE');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.checkin_forms f JOIN public.checkin_form_versions v ON v.form_id=f.id
 WHERE f.id=d.checkin_form_id AND f.user_id=d.user_id AND f.is_active AND f.archived_at IS NULL
 AND v.id=p_form_version_id AND v.status IN ('published','superseded')
 AND (d.form_version_id IS NULL OR d.form_version_id=v.id)) THEN RETURN jsonb_build_object('error','INVALID_LINK'); END IF;
 v_deadline:=coalesce(d.response_deadline,d.due_at,d.sent_at+make_interval(hours=>coalesce(c.checkin_response_window_hours,36)));
 IF d.sent_at IS NULL OR d.sent_at>now() THEN RETURN jsonb_build_object('error','INVALID_LINK'); END IF;
 IF v_deadline<now() THEN RETURN jsonb_build_object('error','EXPIRED'); END IF;
 IF jsonb_typeof(p_responses)<>'object' OR p_responses='{}'::jsonb THEN RETURN jsonb_build_object('error','INVALID_PAYLOAD'); END IF;
 INSERT INTO public.checkin_responses(form_id,client_id,responses,dispatch_id,form_version_id,questions_snapshot)
 VALUES(d.checkin_form_id,d.client_id,p_responses,d.id,p_form_version_id,p_questions_snapshot) RETURNING id INTO v_response;
 -- Update only the occurrence tied to the dispatch, never adjacent weeks.
 UPDATE public.scheduled_checkins SET status='completed',response_id=v_response,updated_at=now()
 WHERE client_id=d.client_id AND scheduled_send_date=d.occurrence_date AND status IN ('pending','sent');
 RETURN jsonb_build_object('success',true,'response_id',v_response);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('error','ALREADY_SUBMITTED');
END; $fn$;
REVOKE ALL ON FUNCTION public.commit_public_checkin_response(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_public_checkin_response(uuid,uuid,jsonb,jsonb) TO service_role;

-- Keep dispatch synchronization scoped to the exact occurrence.
CREATE OR REPLACE FUNCTION public.sync_scheduled_checkin_on_dispatch_sent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NEW.status='sent' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
  UPDATE public.scheduled_checkins SET status='sent',sent_at=coalesce(sent_at,NEW.sent_at),updated_at=now()
  WHERE client_id=NEW.client_id AND scheduled_send_date=NEW.occurrence_date AND status='pending';
 END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION public.sync_scheduled_checkin_on_dispatch_sent() FROM PUBLIC,anon,authenticated;

-- Reversible configuration audit. No clinical answers or financial fields copied.
CREATE TABLE IF NOT EXISTS public.checkin_configuration_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recorded_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL, table_name text NOT NULL, row_id uuid NOT NULL, before_config jsonb NOT NULL
);
ALTER TABLE public.checkin_configuration_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkin_configuration_changes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.checkin_configuration_changes TO service_role;

INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Rogers definitions 2026-09-14','clients',id,jsonb_build_object('consultation_mode',consultation_mode,'structural_review_mode',structural_review_mode,'nutrition_review_interval_days',nutrition_review_interval_days)
FROM public.clients WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND id IN ('f6a1498f-8da1-4353-bab2-f542362a1161','80d1e7d3-5502-4ba8-96c1-46a861529260','2914b8c0-da24-401b-9105-01f62ff7e915');
UPDATE public.clients SET consultation_mode='initial_only',structural_review_mode='every_28_days',nutrition_review_interval_days=28
WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND id IN ('f6a1498f-8da1-4353-bab2-f542362a1161','80d1e7d3-5502-4ba8-96c1-46a861529260','2914b8c0-da24-401b-9105-01f62ff7e915');

INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Rogers definitions 2026-09-14','athlete_checkin_schedules',s.id,to_jsonb(s)
FROM public.athlete_checkin_schedules s JOIN public.clients c ON c.id=s.client_id
WHERE c.user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND c.id IN (
'eab59092-de9e-4c68-815b-356ce51a6763','24ac22b1-6520-474d-95da-b76edf844969','f3703ef1-4067-4b25-9a17-87bc18e26dd8',
'da2420ec-25f8-48fb-8445-8ccd060ec05f','2914b8c0-da24-401b-9105-01f62ff7e915','4b6b57ea-1d67-457c-ae1f-e1feae923ff2',
'e9da345f-1cf6-437c-83cc-61d31128a1af','27a63ddf-3474-46c1-8275-39a18d6b158a','80d1e7d3-5502-4ba8-96c1-46a861529260','4d21df35-801b-46cd-b78b-51c5111ae623');
UPDATE public.athlete_checkin_schedules s SET is_active=true,frequency_type=c.checkin_frequency,
 start_date=coalesce(c.checkin_start_date,s.start_date),weekly_days=ARRAY[1]
FROM public.clients c WHERE c.id=s.client_id AND c.user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND c.id IN ('eab59092-de9e-4c68-815b-356ce51a6763','24ac22b1-6520-474d-95da-b76edf844969','f3703ef1-4067-4b25-9a17-87bc18e26dd8',
'da2420ec-25f8-48fb-8445-8ccd060ec05f','2914b8c0-da24-401b-9105-01f62ff7e915','4b6b57ea-1d67-457c-ae1f-e1feae923ff2',
'e9da345f-1cf6-437c-83cc-61d31128a1af','27a63ddf-3474-46c1-8275-39a18d6b158a','80d1e7d3-5502-4ba8-96c1-46a861529260','4d21df35-801b-46cd-b78b-51c5111ae623')
AND c.is_active AND c.is_frozen IS NOT TRUE AND c.archived_at IS NULL AND c.ended_at IS NULL AND c.end_date>='2026-09-14';
INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Resume Lorena per Rogers','scheduled_checkins',id,to_jsonb(sc) FROM public.scheduled_checkins sc
WHERE client_id='80d1e7d3-5502-4ba8-96c1-46a861529260' AND user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND scheduled_send_date>='2026-09-14' AND status='cancelled';
UPDATE public.scheduled_checkins SET status='pending',updated_at=now()
WHERE client_id='80d1e7d3-5502-4ba8-96c1-46a861529260' AND user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND scheduled_send_date>='2026-09-14' AND status='cancelled';
