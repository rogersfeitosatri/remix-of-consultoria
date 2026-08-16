
CREATE OR REPLACE FUNCTION public.backfill_legacy_meal_plans()
RETURNS TABLE (migrated int, skipped_empty int, already int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_content jsonb;
  v_version uuid;
  n_mig int := 0; n_empty int := 0; n_alr int := 0;
BEGIN
  FOR r IN
    SELECT a.id AS ai_id, a.client_id, public.try_jsonb(a.raw_response) AS raw
    FROM public.ai_analyses a
    WHERE a.client_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.meal_plan_versions v WHERE v.client_id = r.client_id) THEN
      n_alr := n_alr + 1;
      CONTINUE;
    END IF;

    v_content := COALESCE(r.raw->'meal_plan', r.raw->'basePlan');

    IF v_content IS NULL
       OR jsonb_typeof(v_content) <> 'object'
       OR COALESCE(jsonb_array_length(COALESCE(v_content->'meals','[]'::jsonb)), 0) = 0 THEN
      n_empty := n_empty + 1;
      INSERT INTO public.meal_plan_legacy_report(client_id, outcome, detail)
      VALUES (r.client_id, 'no_plan', jsonb_build_object('ai_analysis_id', r.ai_id));
      CONTINUE;
    END IF;

    v_version := public.create_meal_plan_version(
      p_client_id => r.client_id,
      p_content => v_content,
      p_source => 'legacy_import',
      p_orientations => r.raw->'strategic_orientations',
      p_status => 'reviewed',
      p_metadata => jsonb_build_object('backfill', true, 'ai_analysis_id', r.ai_id)
    );
    PERFORM public.publish_meal_plan_version(v_version);
    UPDATE public.meal_plan_versions SET needs_review = true WHERE id = v_version;

    n_mig := n_mig + 1;
    INSERT INTO public.meal_plan_legacy_report(client_id, outcome, detail)
    VALUES (r.client_id, 'migrated', jsonb_build_object('version_id', v_version, 'ai_analysis_id', r.ai_id));
  END LOOP;

  migrated := n_mig; skipped_empty := n_empty; already := n_alr;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_legacy_meal_plans() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_legacy_meal_plans() TO service_role;

DO $$
DECLARE res record;
BEGIN
  SELECT * INTO res FROM public.backfill_legacy_meal_plans();
  RAISE NOTICE 'backfill: migrated=% skipped_empty=% already=%', res.migrated, res.skipped_empty, res.already;
END $$;
