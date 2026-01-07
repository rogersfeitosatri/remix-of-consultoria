-- Drop the old restrictive policy for athletes
DROP POLICY IF EXISTS "Athletes can view active support materials from their nutrition" ON public.support_materials;

-- Create a new policy that allows authenticated users to read active support materials
-- This works for both athletes viewing content and admins previewing
CREATE POLICY "Authenticated users can view active support materials"
ON public.support_materials
FOR SELECT
USING (is_active = true);

-- Also update diet_app_config to be viewable by all authenticated users
DROP POLICY IF EXISTS "Authenticated can view diet app config" ON public.diet_app_config;
CREATE POLICY "Authenticated users can view diet app config"
ON public.diet_app_config
FOR SELECT
USING (true);

-- Update challenge_activities to allow all authenticated users to view active activities
DROP POLICY IF EXISTS "Athletes can view active activities" ON public.challenge_activities;
CREATE POLICY "All authenticated users can view active activities"
ON public.challenge_activities
FOR SELECT
USING (is_active = true);