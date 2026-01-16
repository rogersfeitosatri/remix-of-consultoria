-- 1. Add expense_type and due_day columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN expense_type text NOT NULL DEFAULT 'single' CHECK (expense_type IN ('single', 'subscription')),
ADD COLUMN due_day integer CHECK (due_day >= 1 AND due_day <= 31);

-- 2. Create diet_adjustment_alerts table for tracking diet adjustments
CREATE TABLE public.diet_adjustment_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_adjustment_at timestamp with time zone,
  next_alert_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- 3. Enable RLS on diet_adjustment_alerts
ALTER TABLE public.diet_adjustment_alerts ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for diet_adjustment_alerts
CREATE POLICY "Users can view their own diet alerts"
ON public.diet_adjustment_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diet alerts"
ON public.diet_adjustment_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet alerts"
ON public.diet_adjustment_alerts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet alerts"
ON public.diet_adjustment_alerts
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Create trigger for updated_at on diet_adjustment_alerts
CREATE TRIGGER update_diet_adjustment_alerts_updated_at
BEFORE UPDATE ON public.diet_adjustment_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();