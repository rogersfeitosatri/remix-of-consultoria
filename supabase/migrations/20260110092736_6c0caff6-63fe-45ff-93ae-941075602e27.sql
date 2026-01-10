-- Allow athletes to insert their own consult invite logs (for booking confirmations)
CREATE POLICY "Athletes can log their own booking confirmations"
ON public.consult_invite_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id
      AND c.athlete_user_id = auth.uid()
  )
);