-- Allow athletes to read their own client record (needed for athlete area access)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Athletes can view their own client record'
  ) THEN
    EXECUTE 'DROP POLICY "Athletes can view their own client record" ON public.clients';
  END IF;
END $$;

CREATE POLICY "Athletes can view their own client record"
ON public.clients
FOR SELECT
TO authenticated
USING (athlete_user_id = auth.uid());
