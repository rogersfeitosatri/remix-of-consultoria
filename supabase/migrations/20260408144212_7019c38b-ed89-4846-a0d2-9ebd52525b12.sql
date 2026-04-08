DROP POLICY "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);