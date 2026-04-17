-- Tabela de templates de plano
CREATE TABLE public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  plan_type text NOT NULL DEFAULT 'consultoria',
  service_type text NOT NULL DEFAULT 'nutrition',
  plan_duration text NOT NULL DEFAULT 'monthly',
  has_consultations boolean NOT NULL DEFAULT false,
  consultation_count integer NOT NULL DEFAULT 0,
  consultation_frequency text,
  has_checkin boolean NOT NULL DEFAULT true,
  checkin_frequency text DEFAULT 'weekly',
  suggested_value numeric DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view templates" ON public.plan_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert templates" ON public.plan_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update templates" ON public.plan_templates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can delete templates" ON public.plan_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_plan_templates_user ON public.plan_templates(user_id, order_index);

CREATE TRIGGER trg_plan_templates_updated_at
  BEFORE UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função helper para popular templates padrão para um admin
CREATE OR REPLACE FUNCTION public.seed_default_plan_templates(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só insere se o admin ainda não tem nenhum template
  IF EXISTS (SELECT 1 FROM public.plan_templates WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.plan_templates
    (user_id, name, description, plan_type, service_type, plan_duration, has_consultations, consultation_count, consultation_frequency, has_checkin, checkin_frequency, order_index)
  VALUES
    (p_user_id, 'Consultoria Mensal (só check-in)', 'Acompanhamento sem consultas, check-in mensal', 'consultoria', 'nutrition', 'monthly', false, 0, NULL, true, 'monthly', 1),
    (p_user_id, 'Avulsa - 1 Consulta', 'Plano avulso com 1 consulta única', 'consultoria', 'nutrition', 'monthly', true, 1, NULL, false, NULL, 2),
    (p_user_id, 'Trimestral 3 Consultas (4w)', 'Plano trimestral com 3 consultas a cada 4 semanas', 'consultoria', 'nutrition', 'quarterly', true, 3, 'monthly', true, 'biweekly', 3),
    (p_user_id, 'Trimestral 2 Consultas (6w)', 'Plano trimestral com 2 consultas a cada 6 semanas', 'consultoria', 'nutrition', 'quarterly', true, 2, 'six_weeks', true, 'biweekly', 4),
    (p_user_id, 'Semestral 6 Consultas (4w)', 'Plano semestral com 6 consultas a cada 4 semanas', 'consultoria', 'nutrition', 'semiannual', true, 6, 'monthly', true, 'weekly', 5),
    (p_user_id, 'Semestral 4 Consultas (6w)', 'Plano semestral com 4 consultas a cada 6 semanas', 'consultoria', 'nutrition', 'semiannual', true, 4, 'six_weeks', true, 'weekly', 6),
    (p_user_id, 'Premium Anual (4w)', 'Plano premium anual com consultas ilimitadas a cada 4 semanas', 'premium', 'both', 'annual', true, 0, 'monthly', true, 'weekly', 7),
    (p_user_id, 'Premium Anual (6w)', 'Plano premium anual com consultas ilimitadas a cada 6 semanas', 'premium', 'both', 'annual', true, 0, 'six_weeks', true, 'weekly', 8);
END;
$$;