
-- 1. availability_rules: remove broad USING(true), keep filtered policy
DROP POLICY IF EXISTS "Public can view availability rules for booking" ON public.availability_rules;

-- 2. scheduling_time_blocks: drop redundant duplicate policy
DROP POLICY IF EXISTS "Anyone can view time blocks for public booking" ON public.scheduling_time_blocks;

-- 3. support_materials: restrict public SELECT to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view active support materials" ON public.support_materials;
CREATE POLICY "Authenticated users can view active support materials"
  ON public.support_materials
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 4. checkin_responses: require client_id to belong to the form's owner
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.checkin_responses;
CREATE POLICY "Anyone can submit responses"
  ON public.checkin_responses
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checkin_forms cf
      WHERE cf.id = checkin_responses.form_id
        AND cf.is_active = true
        AND (
          checkin_responses.client_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = checkin_responses.client_id
              AND c.user_id = cf.user_id
          )
        )
    )
  );
