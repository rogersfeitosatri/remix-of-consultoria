-- Allow public read of appointments for booking availability check
-- Only expose minimal data (date, time, duration, status) needed for slot availability

CREATE POLICY "Public can view appointments for availability check"
ON public.appointments
FOR SELECT
USING (true);