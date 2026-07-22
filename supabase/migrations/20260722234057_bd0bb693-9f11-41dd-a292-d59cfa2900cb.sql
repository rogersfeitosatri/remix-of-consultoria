
ALTER TABLE public.zn_plans DROP CONSTRAINT IF EXISTS zn_plans_code_check;
ALTER TABLE public.zn_plans ADD CONSTRAINT zn_plans_code_check CHECK (code = ANY (ARRAY['monthly','quarterly','semiannual','annual']));

ALTER TABLE public.zn_subscriptions DROP CONSTRAINT IF EXISTS zn_subscriptions_plan_code_check;
ALTER TABLE public.zn_subscriptions ADD CONSTRAINT zn_subscriptions_plan_code_check CHECK (plan_code = ANY (ARRAY['monthly','quarterly','semiannual','annual']));

INSERT INTO public.zn_plans (user_id, code, name, price, duration_months, is_active)
SELECT user_id, 'quarterly', 'Trimestral', 179.70, 3, true
FROM public.zn_plans
WHERE code = 'monthly'
ON CONFLICT DO NOTHING;

UPDATE public.zn_plans
SET price = 179.70, name = 'Trimestral', duration_months = 3, is_active = true
WHERE code = 'quarterly';

UPDATE public.zn_plans SET is_active = false WHERE code = 'monthly';
