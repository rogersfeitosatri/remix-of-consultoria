GRANT INSERT, UPDATE, DELETE ON public.form_question_semantics TO authenticated;

DROP POLICY IF EXISTS "Admins manage semantics" ON public.form_question_semantics;
CREATE POLICY "Admins manage semantics"
  ON public.form_question_semantics FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));