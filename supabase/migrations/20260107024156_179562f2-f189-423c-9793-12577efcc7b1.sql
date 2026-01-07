-- Fix the overly permissive INSERT policy on kiwify_purchases
-- This will be secured by webhook secret validation in the edge function
DROP POLICY IF EXISTS "Allow webhook inserts" ON public.kiwify_purchases;

-- Create a more secure policy - only allow service role to insert
-- The edge function will use service role key
CREATE POLICY "Service role can insert purchases"
ON public.kiwify_purchases
FOR INSERT
WITH CHECK (auth.role() = 'service_role');