-- Public booking needs to read configured availability time blocks
-- Enable public SELECT on scheduling_time_blocks (availability hours only; no PII)

CREATE POLICY "Public can view time blocks for booking"
ON public.scheduling_time_blocks
FOR SELECT
USING (true);
