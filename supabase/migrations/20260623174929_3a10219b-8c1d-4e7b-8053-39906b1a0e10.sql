
-- Helper: is a given trainer (user_id) linked to the currently authenticated athlete?
CREATE OR REPLACE FUNCTION public.is_trainer_of_current_athlete(_trainer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.user_id = _trainer_id
      AND lower(c.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  OR public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- challenge_activities: replace overly-broad SELECT policies
DROP POLICY IF EXISTS "All authenticated users can view active activities" ON public.challenge_activities;
DROP POLICY IF EXISTS "Athletes can view active challenge activities" ON public.challenge_activities;

CREATE POLICY "Athletes view active activities of their trainer"
ON public.challenge_activities
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    auth.uid() = user_id
    OR public.is_trainer_of_current_athlete(user_id)
  )
);

-- support_materials: replace overly-broad SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view active support materials" ON public.support_materials;

CREATE POLICY "Athletes view active support materials of their trainer"
ON public.support_materials
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    auth.uid() = user_id
    OR public.is_trainer_of_current_athlete(user_id)
  )
);
