-- ETAPA 3C — permissões de acesso às tabelas de versões de formulários
GRANT SELECT, INSERT, UPDATE ON public.checkin_form_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.anamnese_form_versions TO authenticated;
GRANT SELECT, INSERT ON public.checkin_form_version_questions TO authenticated;
GRANT SELECT, INSERT ON public.anamnese_form_version_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.athlete_checkin_form_overrides TO authenticated;
GRANT ALL ON public.checkin_form_versions TO service_role;
GRANT ALL ON public.anamnese_form_versions TO service_role;
GRANT ALL ON public.checkin_form_version_questions TO service_role;
GRANT ALL ON public.anamnese_form_version_questions TO service_role;
GRANT ALL ON public.athlete_checkin_form_overrides TO service_role;

-- O formulário público do atleta precisa ler a definição congelada da versão.
GRANT SELECT ON public.checkin_form_versions TO anon;
GRANT SELECT ON public.checkin_form_version_questions TO anon;
GRANT SELECT ON public.anamnese_form_versions TO anon;
GRANT SELECT ON public.anamnese_form_version_questions TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.checkin_form_version_questions'::regclass AND polname='public_read_published_checkin_version_questions') THEN
    CREATE POLICY "public_read_published_checkin_version_questions"
      ON public.checkin_form_version_questions FOR SELECT TO anon
      USING (EXISTS (SELECT 1 FROM public.checkin_form_versions v WHERE v.id = version_id AND v.status IN ('published','superseded')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.checkin_form_versions'::regclass AND polname='public_read_published_checkin_versions') THEN
    CREATE POLICY "public_read_published_checkin_versions"
      ON public.checkin_form_versions FOR SELECT TO anon
      USING (status IN ('published','superseded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.anamnese_form_version_questions'::regclass AND polname='public_read_published_anamnese_version_questions') THEN
    CREATE POLICY "public_read_published_anamnese_version_questions"
      ON public.anamnese_form_version_questions FOR SELECT TO anon
      USING (EXISTS (SELECT 1 FROM public.anamnese_form_versions v WHERE v.id = version_id AND v.status IN ('published','superseded')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.anamnese_form_versions'::regclass AND polname='public_read_published_anamnese_versions') THEN
    CREATE POLICY "public_read_published_anamnese_versions"
      ON public.anamnese_form_versions FOR SELECT TO anon
      USING (status IN ('published','superseded'));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_checkin_dispatch_version(text) TO anon, authenticated;