
CREATE TABLE IF NOT EXISTS public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expense_id, period_year, period_month)
);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own expense payments" ON public.expense_payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own expense payments" ON public.expense_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own expense payments" ON public.expense_payments
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users update own expense payments" ON public.expense_payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON public.expense_payments(expense_id, period_year, period_month);
