
-- ============================================================
-- FASE 1: ONBOARDING DE NOVOS ATLETAS (Mercado Pago)
-- ============================================================

-- 1) Tabela onboarding_plans (6 planos fixos)
CREATE TABLE IF NOT EXISTS public.onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('consultoria','consultas')),
  periodicity TEXT NOT NULL CHECK (periodicity IN ('trimestral','semestral','anual')),
  name TEXT NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL,
  consultations_count INTEGER NOT NULL DEFAULT 0,
  consultation_interval_weeks INTEGER NOT NULL DEFAULT 0,
  checkin_frequency TEXT,
  payment_link TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.onboarding_plans TO authenticated;
GRANT ALL ON public.onboarding_plans TO service_role;

ALTER TABLE public.onboarding_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active onboarding plans"
  ON public.onboarding_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage onboarding plans"
  ON public.onboarding_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Tabela onboarding_payment_settings (singleton por admin)
CREATE TABLE IF NOT EXISTS public.onboarding_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  mp_public_key TEXT,
  reminder_days INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_payment_settings TO authenticated;
GRANT ALL ON public.onboarding_payment_settings TO service_role;

ALTER TABLE public.onboarding_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment settings"
  ON public.onboarding_payment_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_onboarding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_plans_updated ON public.onboarding_plans;
CREATE TRIGGER trg_onboarding_plans_updated
  BEFORE UPDATE ON public.onboarding_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_payment_settings_updated ON public.onboarding_payment_settings;
CREATE TRIGGER trg_onboarding_payment_settings_updated
  BEFORE UPDATE ON public.onboarding_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_updated_at();

-- 4) Colunas em clients (não altera dados existentes)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS selected_plan_id UUID REFERENCES public.onboarding_plans(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_status TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plan_sent_at TIMESTAMPTZ;

-- 5) Seed dos 6 planos
INSERT INTO public.onboarding_plans
  (slug, category, periodicity, name, description, duration_months, consultations_count, consultation_interval_weeks, checkin_frequency, price, order_index)
VALUES
  ('consultoria_trimestral', 'consultoria', 'trimestral', 'Consultoria Trimestral', 'Plano alimentar + acompanhamento por 3 meses, com check-in mensal.', 3, 0, 0, 'monthly', 497.00, 1),
  ('consultoria_semestral',  'consultoria', 'semestral',  'Consultoria Semestral',  'Plano alimentar + acompanhamento por 6 meses, com check-in mensal.', 6, 0, 0, 'monthly', 797.00, 2),
  ('consultoria_anual',      'consultoria', 'anual',      'Consultoria Anual',      'Plano alimentar + acompanhamento por 12 meses, com check-in mensal.', 12, 0, 0, 'monthly', 1497.00, 3),
  ('consultas_trimestral',   'consultas',   'trimestral', 'Consultas Trimestral',   '3 meses com 2 consultas + check-in quinzenal.', 3, 2, 6, 'biweekly', 997.00, 4),
  ('consultas_semestral',    'consultas',   'semestral',  'Consultas Semestral',    '6 meses com 4 consultas + check-in quinzenal.', 6, 4, 6, 'biweekly', 1697.00, 5),
  ('consultas_anual',        'consultas',   'anual',      'Consultas Anual',        '12 meses com 8 consultas + check-in quinzenal.', 12, 8, 6, 'biweekly', 2997.00, 6)
ON CONFLICT (slug) DO NOTHING;

-- 6) Seed dos 4 templates de WhatsApp (um por admin existente)
INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, variables, is_active, default_timing)
SELECT ur.user_id, t.template_key, t.template_name, t.title, t.body, t.variables, true, NULL
FROM public.user_roles ur
CROSS JOIN (VALUES
  ('onboarding_payment_link', 'Onboarding · Link de Pagamento',
   'Onboarding · Link de Pagamento',
   'Olá {nome_atleta}! 🎉 Recebemos sua anamnese. Para ativar seu plano *{plano_nome}*, finalize o pagamento pelo link: {link_pagamento}. Qualquer dúvida, estou à disposição!',
   ARRAY['nome_atleta','plano_nome','link_pagamento']),
  ('onboarding_confirmation_consultoria', 'Onboarding · Confirmação Consultoria',
   'Onboarding · Confirmação Consultoria',
   '{nome_atleta}, pagamento confirmado! ✅ Seu plano *{plano_nome}* está ativo. Em até 4 dias úteis você receberá seu plano alimentar com todas as instruções. Vamos juntos! 💪',
   ARRAY['nome_atleta','plano_nome']),
  ('onboarding_confirmation_consultas', 'Onboarding · Confirmação Consultas',
   'Onboarding · Confirmação Consultas',
   '{nome_atleta}, pagamento confirmado! ✅ Seu plano *{plano_nome}* está ativo. Agende sua primeira consulta pelo link: {link_agendamento}. Estou te esperando!',
   ARRAY['nome_atleta','plano_nome','link_agendamento']),
  ('onboarding_payment_reminder', 'Onboarding · Lembrete de Pagamento',
   'Onboarding · Lembrete de Pagamento',
   'Olá {nome_atleta}, notei que o pagamento do plano *{plano_nome}* ainda não foi realizado. O link continua disponível: {link_pagamento}. Posso te ajudar com alguma dúvida?',
   ARRAY['nome_atleta','plano_nome','link_pagamento'])
) AS t(template_key, template_name, title, body, variables)
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;
