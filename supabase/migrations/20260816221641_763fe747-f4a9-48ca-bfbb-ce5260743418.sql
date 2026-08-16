-- ETAPA 6A — fecha o INSERT anônimo em checkin_responses.
-- A partir daqui, o envio público de check-in só ocorre pela edge function
-- submit-public-checkin (service_role), que valida dispatch, telefone,
-- prazo, estado operacional do atleta e duplicidade.

DROP POLICY IF EXISTS "Anyone can submit responses" ON public.checkin_responses;

REVOKE INSERT ON public.checkin_responses FROM anon;
REVOKE ALL ON public.checkin_responses FROM anon;

GRANT SELECT, UPDATE ON public.checkin_responses TO authenticated;
GRANT ALL ON public.checkin_responses TO service_role;

-- Admin/dono do formulário continua podendo registrar manualmente.
DROP POLICY IF EXISTS "Form owners can insert responses" ON public.checkin_responses;
CREATE POLICY "Form owners can insert responses"
ON public.checkin_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checkin_forms f
    WHERE f.id = checkin_responses.form_id
      AND f.user_id = auth.uid()
  )
);