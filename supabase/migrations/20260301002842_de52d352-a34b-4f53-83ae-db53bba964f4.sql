
-- Table to store previous plan snapshots before renewal
CREATE TABLE public.client_plan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL,
  service_type TEXT NOT NULL,
  plan_duration TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  checkin_frequency TEXT,
  has_checkin BOOLEAN DEFAULT false,
  has_consultations BOOLEAN DEFAULT false,
  consultation_count INTEGER DEFAULT 0,
  consultation_frequency TEXT,
  has_agenda_access BOOLEAN DEFAULT false,
  payment_type TEXT,
  notes TEXT,
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their plan history"
  ON public.client_plan_history
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_client_plan_history_client_id ON public.client_plan_history(client_id);
