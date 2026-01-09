-- Public booking needs to read availability rules (no PII)

CREATE POLICY "Public can view availability rules for booking"
ON public.availability_rules
FOR SELECT
USING (true);