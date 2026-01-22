-- Allow anamnese_responses to be submitted without a client_id (public open form)
-- Add columns to identify respondent when not linked to a client

-- Make client_id nullable
ALTER TABLE public.anamnese_responses 
ALTER COLUMN client_id DROP NOT NULL;

-- Add columns for respondent identification when no client link exists
ALTER TABLE public.anamnese_responses 
ADD COLUMN IF NOT EXISTS respondent_name TEXT,
ADD COLUMN IF NOT EXISTS respondent_email TEXT;

-- Create index for finding unlinked responses
CREATE INDEX IF NOT EXISTS idx_anamnese_responses_unlinked 
ON public.anamnese_responses(form_id) 
WHERE client_id IS NULL;

-- Update RLS policy to allow inserting responses without auth (public form)
DROP POLICY IF EXISTS "Allow public anamnese submission" ON public.anamnese_responses;
CREATE POLICY "Allow public anamnese submission" 
ON public.anamnese_responses 
FOR INSERT 
WITH CHECK (true);

-- Allow admin to update responses (to link them to clients)
DROP POLICY IF EXISTS "Admin can update anamnese responses" ON public.anamnese_responses;
CREATE POLICY "Admin can update anamnese responses" 
ON public.anamnese_responses 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.anamnese_forms af 
    WHERE af.id = form_id AND af.user_id = auth.uid()
  )
);

-- Allow admin to read all responses for their forms
DROP POLICY IF EXISTS "Admin can read their form responses" ON public.anamnese_responses;
CREATE POLICY "Admin can read their form responses" 
ON public.anamnese_responses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.anamnese_forms af 
    WHERE af.id = form_id AND af.user_id = auth.uid()
  )
  OR client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = client_id AND c.athlete_user_id = auth.uid()
  )
);