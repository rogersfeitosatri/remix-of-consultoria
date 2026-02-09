-- Política para permitir que admins insiram perfis de atletas dos seus clientes
CREATE POLICY "Admins can insert athlete profiles for their clients"
ON public.athlete_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = athlete_profiles.client_id
    AND clients.user_id = auth.uid()
  )
);