-- ETAPA 5C — leitura canônica do atleta autenticado
GRANT SELECT ON public.checkin_dispatches TO authenticated;
GRANT SELECT ON public.consultation_schedules TO authenticated;

DROP POLICY IF EXISTS "Athletes read their own checkin dispatches" ON public.checkin_dispatches;
CREATE POLICY "Athletes read their own checkin dispatches"
ON public.checkin_dispatches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = checkin_dispatches.client_id AND c.athlete_user_id = auth.uid()));

DROP POLICY IF EXISTS "Athletes read their own consultation schedules" ON public.consultation_schedules;
CREATE POLICY "Athletes read their own consultation schedules"
ON public.consultation_schedules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = consultation_schedules.client_id AND c.athlete_user_id = auth.uid()));