-- zn_plans centralize
UPDATE public.zn_plans SET price = 69.90  WHERE code = 'monthly'    AND (price IS NULL OR price = 0);
UPDATE public.zn_plans SET price = 299.00 WHERE code = 'semiannual' AND (price IS NULL OR price = 0);
UPDATE public.zn_plans SET price = 419.90 WHERE code = 'annual'     AND (price IS NULL OR price = 0);

UPDATE public.zn_plans SET name = 'Mensal'    WHERE code = 'monthly'    AND name = 'ZN Mensal';
UPDATE public.zn_plans SET name = 'Semestral' WHERE code = 'semiannual' AND name = 'ZN Semestral';
UPDATE public.zn_plans SET name = 'Anual'     WHERE code = 'annual'     AND name = 'ZN Anual';

CREATE OR REPLACE FUNCTION public.seed_default_zn_plans(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.zn_plans WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.zn_plans (user_id, code, name, duration_months, price, description) VALUES
    (p_user_id, 'monthly',    'Mensal',    1,  69.90,  'Acesso mensal ao ZN Assessoria'),
    (p_user_id, 'semiannual', 'Semestral', 6,  299.00, 'Acesso semestral ao ZN Assessoria'),
    (p_user_id, 'annual',     'Anual',    12,  419.90, 'Acesso anual ao ZN Assessoria');
END;
$$;

GRANT SELECT ON public.zn_plans TO anon;
DROP POLICY IF EXISTS "zn_plans public read active" ON public.zn_plans;
CREATE POLICY "zn_plans public read active"
  ON public.zn_plans FOR SELECT
  TO anon
  USING (is_active = true);

-- anamnese single question wizard
ALTER TABLE public.anamnese_forms
  ADD COLUMN IF NOT EXISTS single_question_wizard boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.anamnese_forms.single_question_wizard IS
  'Quando true, a anamnese é exibida ao atleta como wizard de 1 pergunta por tela (refeições e dias de treino em telas separadas).';

NOTIFY pgrst, 'reload schema';