-- Permitir que o atleta visualize (somente leitura) a própria análise de IA
-- (plano alimentar + orientações estratégicas) na área do atleta.
-- Antes, ai_analyses era restrito a admins.

drop policy if exists "Athletes can view their own AI analysis" on public.ai_analyses;

create policy "Athletes can view their own AI analysis"
  on public.ai_analyses
  for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = ai_analyses.client_id
        and c.athlete_user_id = auth.uid()
    )
  );
