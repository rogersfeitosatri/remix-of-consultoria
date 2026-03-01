-- Allow anonymous inserts into strategic_call_responses (public form)
CREATE POLICY "Anyone can insert strategic call responses"
ON public.strategic_call_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
