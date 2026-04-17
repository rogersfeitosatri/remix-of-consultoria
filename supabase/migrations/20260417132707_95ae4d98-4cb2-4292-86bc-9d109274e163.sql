
-- Table to store completed/archived target races per athlete
CREATE TABLE public.athlete_completed_races (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_athlete_completed_races_client ON public.athlete_completed_races(client_id, race_date DESC);

ALTER TABLE public.athlete_completed_races ENABLE ROW LEVEL SECURITY;

-- Admins (owners) can manage
CREATE POLICY "Admins manage own clients completed races"
ON public.athlete_completed_races
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Athletes can view their own completed races
CREATE POLICY "Athletes view own completed races"
ON public.athlete_completed_races
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.athlete_user_id = auth.uid()
  )
);
