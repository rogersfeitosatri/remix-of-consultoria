
-- Financial transactions: daily expenses and income
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  area TEXT NOT NULL CHECK (area IN ('pessoal', 'empresa', 'consultoria', 'assessoria')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  card_name TEXT,
  installments INTEGER DEFAULT 1,
  current_installment INTEGER DEFAULT 1,
  origin TEXT, -- for income: source
  receipt_method TEXT, -- for income: how received
  is_recurring BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own financial_transactions"
  ON public.financial_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Financial debts
CREATE TABLE public.financial_debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  area TEXT NOT NULL CHECK (area IN ('pessoal', 'empresa', 'consultoria', 'assessoria')),
  has_due_date BOOLEAN DEFAULT false,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'quitada')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own financial_debts"
  ON public.financial_debts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_financial_debts_updated_at
  BEFORE UPDATE ON public.financial_debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_financial_transactions_user_date ON public.financial_transactions(user_id, date);
CREATE INDEX idx_financial_transactions_area ON public.financial_transactions(area);
CREATE INDEX idx_financial_debts_user ON public.financial_debts(user_id);
