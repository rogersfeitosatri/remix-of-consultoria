-- Centraliza os planos da assessoria (ZN) na tabela zn_plans:
-- 1) Preenche os preços reais atuais (só onde ainda está 0), para não quebrar
--    o fluxo ao migrar do valor "hardcoded" para o banco.
-- 2) Atualiza o seed de novos admins com os valores reais.
-- 3) Libera leitura pública (anon) dos planos ATIVOS, pois o wizard público
--    (?zn=1) precisa exibir os preços sem login.

UPDATE public.zn_plans SET price = 69.90  WHERE code = 'monthly'    AND (price IS NULL OR price = 0);
UPDATE public.zn_plans SET price = 299.00 WHERE code = 'semiannual' AND (price IS NULL OR price = 0);
UPDATE public.zn_plans SET price = 419.90 WHERE code = 'annual'     AND (price IS NULL OR price = 0);

-- Nomes amigáveis padrão (só se estiverem com o nome antigo/genérico)
UPDATE public.zn_plans SET name = 'Mensal'    WHERE code = 'monthly'    AND name = 'ZN Mensal';
UPDATE public.zn_plans SET name = 'Semestral' WHERE code = 'semiannual' AND name = 'ZN Semestral';
UPDATE public.zn_plans SET name = 'Anual'     WHERE code = 'annual'     AND name = 'ZN Anual';

-- Seed para novos admins com valores reais
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

-- Leitura pública apenas dos planos ativos (preços não são sensíveis; o wizard
-- público precisa exibi-los). Escrita continua restrita ao dono.
GRANT SELECT ON public.zn_plans TO anon;
DROP POLICY IF EXISTS "zn_plans public read active" ON public.zn_plans;
CREATE POLICY "zn_plans public read active"
  ON public.zn_plans FOR SELECT
  TO anon
  USING (is_active = true);

NOTIFY pgrst, 'reload schema';
