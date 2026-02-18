
-- Create target_races library table
CREATE TABLE public.target_races (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.target_races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their own races"
  ON public.target_races
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
