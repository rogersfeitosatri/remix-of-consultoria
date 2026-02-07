-- Create RLS policy to allow admin to delete unlinked anamnese responses
-- Admin can only delete responses that have NO client_id (unlinked)
CREATE POLICY "Admin can delete unlinked anamnese responses"
ON public.anamnese_responses
FOR DELETE
USING (
  client_id IS NULL
  AND EXISTS (
    SELECT 1 FROM anamnese_forms
    WHERE anamnese_forms.id = anamnese_responses.form_id
    AND anamnese_forms.user_id = auth.uid()
  )
);