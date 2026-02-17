-- Phase transition history log
CREATE TABLE public.journey_phase_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_periodization_id UUID NOT NULL REFERENCES public.athlete_periodization(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_phase_id UUID REFERENCES public.journey_phases(id) ON DELETE SET NULL,
  to_phase_id UUID REFERENCES public.journey_phases(id) ON DELETE SET NULL,
  from_phase_name TEXT,
  to_phase_name TEXT,
  transition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  auto_adjustments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_phase_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their transitions" ON public.journey_phase_transitions
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE athlete_user_id = auth.uid())
  );

CREATE POLICY "Users can insert transitions" ON public.journey_phase_transitions
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete transitions" ON public.journey_phase_transitions
  FOR DELETE USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Add adjustment_log column to journey_weeks for tracking changes
ALTER TABLE public.journey_weeks ADD COLUMN IF NOT EXISTS adjustment_log JSONB DEFAULT '[]';
