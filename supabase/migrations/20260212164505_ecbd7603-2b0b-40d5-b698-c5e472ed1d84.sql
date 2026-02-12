
-- Table for storing initial/adjustment balances
CREATE TABLE public.financial_initial_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  area TEXT NOT NULL DEFAULT 'geral' CHECK (area IN ('geral', 'pessoal', 'empresa')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_initial_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own financial_initial_balances"
  ON public.financial_initial_balances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_financial_initial_balances_updated_at
  BEFORE UPDATE ON public.financial_initial_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
