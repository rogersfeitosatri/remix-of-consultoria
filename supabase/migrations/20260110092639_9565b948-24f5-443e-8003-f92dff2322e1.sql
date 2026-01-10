-- Allow athletes to create/update their own consultation schedule rules
-- This is needed when they book a consultation and the system creates the rule automatically

-- First, let's create policies for athletes to manage their own rules via their client record
CREATE POLICY "Athletes can upsert their own consultation rules"
ON public.consultation_schedule_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = consultation_schedule_rules.client_id
      AND c.athlete_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id
      AND c.athlete_user_id = auth.uid()
  )
);

-- Allow athletes to read their own client data for the booking flow
CREATE POLICY "Athletes can read their own client data for booking"
ON public.clients
FOR SELECT
USING (athlete_user_id = auth.uid());

-- Allow athletes to update their first_consultation_date
CREATE POLICY "Athletes can update their own first consultation date"
ON public.clients
FOR UPDATE
USING (athlete_user_id = auth.uid())
WITH CHECK (athlete_user_id = auth.uid());