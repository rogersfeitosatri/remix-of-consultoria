
-- Tabela para controle de envio de plano alimentar
CREATE TABLE public.meal_plan_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.meal_plan_status ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own meal plan status"
ON public.meal_plan_status
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meal plan status"
ON public.meal_plan_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal plan status"
ON public.meal_plan_status
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal plan status"
ON public.meal_plan_status
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_meal_plan_status_updated_at
BEFORE UPDATE ON public.meal_plan_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_meal_plan_status_client ON public.meal_plan_status(client_id);
CREATE INDEX idx_meal_plan_status_user_status ON public.meal_plan_status(user_id, status);
