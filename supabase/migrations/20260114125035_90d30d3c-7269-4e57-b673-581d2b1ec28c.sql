-- Fix the overly permissive RLS policy for whatsapp_message_logs
-- Drop the permissive INSERT policy and create a proper one
DROP POLICY IF EXISTS "Service role can insert logs" ON public.whatsapp_message_logs;

-- Create a proper INSERT policy that checks user_id
CREATE POLICY "Users can insert their own logs" 
ON public.whatsapp_message_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);