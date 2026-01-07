-- Fix permissive INSERT policy for athlete_profiles
DROP POLICY IF EXISTS "Service role can insert athlete profiles" ON public.athlete_profiles;

-- Athletes can insert their own profile
CREATE POLICY "Athletes can insert their own profile"
  ON public.athlete_profiles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = athlete_profiles.client_id 
    AND clients.athlete_user_id = auth.uid()
  ));