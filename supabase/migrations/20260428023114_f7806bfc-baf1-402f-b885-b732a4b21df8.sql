CREATE TABLE IF NOT EXISTS public.np_event_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  race_id UUID REFERENCES public.np_athlete_races(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('phase_taper_entry','carboloading_start','gut_training_weekly','race_day')),
  event_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, race_id, event_type, event_key)
);
CREATE INDEX IF NOT EXISTS idx_np_event_dispatches_client ON public.np_event_dispatches(client_id, event_type, sent_at DESC);
ALTER TABLE public.np_event_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "np_event_dispatches_admin_all" ON public.np_event_dispatches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);