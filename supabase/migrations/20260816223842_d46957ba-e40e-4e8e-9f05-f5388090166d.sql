
-- ETAPA 6B — backfill idempotente do plano legado (ai_analyses.raw_response)
-- para o núcleo canônico meal_plans/meal_plan_versions + relatório de divergência.

CREATE TABLE IF NOT EXISTS public.meal_plan_legacy_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  outcome text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meal_plan_legacy_report TO authenticated;
GRANT ALL ON public.meal_plan_legacy_report TO service_role;
ALTER TABLE public.meal_plan_legacy_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read legacy meal plan report" ON public.meal_plan_legacy_report;
CREATE POLICY "admins read legacy meal plan report"
ON public.meal_plan_legacy_report FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

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
    SELECT a.id AS ai_id, a.client_id, a.user_id, public.try_jsonb(a.raw_response) AS raw
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
