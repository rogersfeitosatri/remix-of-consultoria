-- Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.strategic_call_responses;