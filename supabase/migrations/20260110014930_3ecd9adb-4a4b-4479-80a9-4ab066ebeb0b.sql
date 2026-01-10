-- Allow athletes to create booking links for themselves
CREATE POLICY "Athletes can create their own booking link"
ON public.booking_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id
      AND c.athlete_user_id = auth.uid()
  )
);

-- Allow athletes to update their own booking link (for usage_count)
CREATE POLICY "Athletes can update their own booking link"
ON public.booking_links
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = booking_links.client_id
      AND c.athlete_user_id = auth.uid()
  )
);