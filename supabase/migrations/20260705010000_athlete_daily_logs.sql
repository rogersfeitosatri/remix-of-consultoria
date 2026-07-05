-- Registro diário do atleta: refeições concluídas e água ingerida.
-- Uma linha por (cliente, dia). O atleta gerencia o próprio registro.

create table if not exists public.athlete_daily_logs (
  client_id uuid not null references public.clients(id) on delete cascade,
  log_date date not null,
  water_ml integer not null default 0,
  completed_meals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (client_id, log_date)
);

create index if not exists athlete_daily_logs_client_idx on public.athlete_daily_logs (client_id, log_date desc);

alter table public.athlete_daily_logs enable row level security;

-- O próprio atleta (via clients.athlete_user_id) gerencia seus registros.
drop policy if exists "Athlete manages own daily logs" on public.athlete_daily_logs;
create policy "Athlete manages own daily logs"
  on public.athlete_daily_logs
  for all
  using (
    exists (
      select 1 from public.clients c
      where c.id = athlete_daily_logs.client_id
        and c.athlete_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = athlete_daily_logs.client_id
        and c.athlete_user_id = auth.uid()
    )
  );

-- O admin dono do cliente pode ler (para acompanhar a adesão).
drop policy if exists "Admin reads client daily logs" on public.athlete_daily_logs;
create policy "Admin reads client daily logs"
  on public.athlete_daily_logs
  for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = athlete_daily_logs.client_id
        and c.user_id = auth.uid()
    )
  );
