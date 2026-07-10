
-- ============================================================
-- ZN ASSESSORIA — módulo isolado (tabelas zn_*)
-- ============================================================

-- ---------- zn_athletes ----------
CREATE TABLE public.zn_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  cpf_cnpj text,
  asaas_customer_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','inactive')),
  first_payment_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE INDEX idx_zn_athletes_user ON public.zn_athletes(user_id);
CREATE INDEX idx_zn_athletes_asaas_customer ON public.zn_athletes(asaas_customer_id);
CREATE INDEX idx_zn_athletes_status ON public.zn_athletes(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_athletes TO authenticated;
GRANT ALL ON public.zn_athletes TO service_role;
ALTER TABLE public.zn_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zn_athletes owner all"
  ON public.zn_athletes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_plans ----------
CREATE TABLE public.zn_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL
    CHECK (code IN ('monthly','semiannual','annual')),
  name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  price numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
CREATE INDEX idx_zn_plans_user ON public.zn_plans(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_plans TO authenticated;
GRANT ALL ON public.zn_plans TO service_role;
ALTER TABLE public.zn_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zn_plans owner all"
  ON public.zn_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_subscriptions ----------
CREATE TABLE public.zn_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.zn_athletes(id) ON DELETE CASCADE,
  plan_code text NOT NULL
    CHECK (plan_code IN ('monthly','semiannual','annual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','overdue','suspended','cancelled','expired')),
  start_date date,
  expires_at date,
  asaas_customer_id text,
  asaas_subscription_id text,
  last_payment_id uuid,
  cancel_reason text,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zn_subs_user ON public.zn_subscriptions(user_id);
CREATE INDEX idx_zn_subs_athlete ON public.zn_subscriptions(athlete_id);
CREATE INDEX idx_zn_subs_status ON public.zn_subscriptions(status);
CREATE INDEX idx_zn_subs_asaas_sub ON public.zn_subscriptions(asaas_subscription_id);
CREATE INDEX idx_zn_subs_asaas_customer ON public.zn_subscriptions(asaas_customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_subscriptions TO authenticated;
GRANT ALL ON public.zn_subscriptions TO service_role;
ALTER TABLE public.zn_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zn_subscriptions owner all"
  ON public.zn_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_payments ----------
CREATE TABLE public.zn_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.zn_athletes(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.zn_subscriptions(id) ON DELETE SET NULL,
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_customer_id text,
  asaas_subscription_id text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','received','overdue','refunded','failed','deleted')),
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  event_type text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zn_payments_user ON public.zn_payments(user_id);
CREATE INDEX idx_zn_payments_athlete ON public.zn_payments(athlete_id);
CREATE INDEX idx_zn_payments_sub ON public.zn_payments(subscription_id);
CREATE INDEX idx_zn_payments_status ON public.zn_payments(status);
CREATE INDEX idx_zn_payments_paid_at ON public.zn_payments(paid_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_payments TO authenticated;
GRANT ALL ON public.zn_payments TO service_role;
ALTER TABLE public.zn_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zn_payments owner all"
  ON public.zn_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_webhook_events (idempotência + auditoria) ----------
CREATE TABLE public.zn_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id text UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zn_events_status ON public.zn_webhook_events(status);
CREATE INDEX idx_zn_events_type ON public.zn_webhook_events(event_type);
CREATE INDEX idx_zn_events_received ON public.zn_webhook_events(received_at DESC);

GRANT SELECT ON public.zn_webhook_events TO authenticated;
GRANT ALL ON public.zn_webhook_events TO service_role;
ALTER TABLE public.zn_webhook_events ENABLE ROW LEVEL SECURITY;

-- Só admins veem os eventos crus (fonte oficial: service_role escreve)
CREATE POLICY "zn_webhook_events admin read"
  ON public.zn_webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- zn_integration_outbox (stub Zona Nutri) ----------
CREATE TABLE public.zn_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.zn_athletes(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.zn_subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zn_outbox_user ON public.zn_integration_outbox(user_id);
CREATE INDEX idx_zn_outbox_status ON public.zn_integration_outbox(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_integration_outbox TO authenticated;
GRANT ALL ON public.zn_integration_outbox TO service_role;
ALTER TABLE public.zn_integration_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zn_outbox owner all"
  ON public.zn_integration_outbox FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- Triggers updated_at ----------
CREATE TRIGGER trg_zn_athletes_updated
  BEFORE UPDATE ON public.zn_athletes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zn_plans_updated
  BEFORE UPDATE ON public.zn_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zn_subs_updated
  BEFORE UPDATE ON public.zn_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zn_payments_updated
  BEFORE UPDATE ON public.zn_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zn_events_updated
  BEFORE UPDATE ON public.zn_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zn_outbox_updated
  BEFORE UPDATE ON public.zn_integration_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Seed inicial dos 3 planos para cada admin ----------
CREATE OR REPLACE FUNCTION public.seed_default_zn_plans(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.zn_plans WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.zn_plans (user_id, code, name, duration_months, price, description) VALUES
    (p_user_id, 'monthly',   'ZN Mensal',    1,  0, 'Acesso mensal ao ZN Assessoria'),
    (p_user_id, 'semiannual','ZN Semestral', 6,  0, 'Acesso semestral ao ZN Assessoria'),
    (p_user_id, 'annual',    'ZN Anual',    12,  0, 'Acesso anual ao ZN Assessoria');
END;
$$;

-- Semeia para todos os admins existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    PERFORM public.seed_default_zn_plans(r.user_id);
  END LOOP;
END $$;
