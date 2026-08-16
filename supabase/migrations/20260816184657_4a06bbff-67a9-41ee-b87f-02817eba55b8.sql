-- ETAPA 3A — Núcleo canônico de Plano Alimentar
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create table if not exists public.meal_plan_versions (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null,
  version_number integer not null,
  source text not null default 'manual_editor'
    check (source in ('manual_editor','classic_editor','ai_generated','pdf_import','markdown_import','attached_plan','legacy_import','checkin_update')),
  status text not null default 'draft'
    check (status in ('draft','reviewed','published','superseded','archived')),
  content jsonb not null default '{}'::jsonb,
  orientations jsonb,
  needs_review boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  superseded_at timestamptz,
  parent_version_id uuid references public.meal_plan_versions(id) on delete set null,
  ai_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (meal_plan_id, version_number)
);

alter table public.meal_plans
  add constraint meal_plans_current_version_fkey
  foreign key (current_version_id) references public.meal_plan_versions(id) on delete set null;

-- Só UMA versão publicada por plano
create unique index if not exists uq_meal_plan_versions_one_published
  on public.meal_plan_versions (meal_plan_id) where status = 'published';

create index if not exists idx_mpv_client_status on public.meal_plan_versions (client_id, status, created_at desc);
create index if not exists idx_mpv_plan on public.meal_plan_versions (meal_plan_id, version_number desc);
create index if not exists idx_meal_plans_user on public.meal_plans (user_id);

grant select, insert, update, delete on public.meal_plans to authenticated;
grant all on public.meal_plans to service_role;
grant select, insert, update, delete on public.meal_plan_versions to authenticated;
grant all on public.meal_plan_versions to service_role;

alter table public.meal_plans enable row level security;
alter table public.meal_plan_versions enable row level security;

-- ADMIN (dono do atleta) gerencia tudo
create policy "admin manages own meal plans" on public.meal_plans
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin manages own meal plan versions" on public.meal_plan_versions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ATLETA: só leitura da própria versão PUBLICADA
create policy "athlete reads own published version" on public.meal_plan_versions
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.clients c
      where c.id = meal_plan_versions.client_id
        and c.athlete_user_id = auth.uid()
    )
  );

create policy "athlete reads own meal plan" on public.meal_plans
  for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = meal_plans.client_id
        and c.athlete_user_id = auth.uid()
    )
  );

create trigger update_meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.update_updated_at_column();
create trigger update_meal_plan_versions_updated_at before update on public.meal_plan_versions
  for each row execute function public.update_updated_at_column();

-- ============ RPC: criar versão (draft) ============
create or replace function public.create_meal_plan_version(
  p_client_id uuid,
  p_content jsonb,
  p_source text default 'manual_editor',
  p_orientations jsonb default null,
  p_status text default 'draft',
  p_parent_version_id uuid default null,
  p_ai_metadata jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_needs_review boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan_id uuid;
  v_next int;
  v_id uuid;
begin
  select user_id into v_owner from public.clients where id = p_client_id;
  if v_owner is null then raise exception 'Cliente não encontrado'; end if;
  if auth.uid() is distinct from v_owner then
    raise exception 'Sem permissão para este atleta';
  end if;
  if p_status not in ('draft','reviewed') then
    raise exception 'Versão só pode nascer como draft ou reviewed';
  end if;

  insert into public.meal_plans (user_id, client_id)
  values (v_owner, p_client_id)
  on conflict (client_id) do update set updated_at = now()
  returning id into v_plan_id;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.meal_plan_versions where meal_plan_id = v_plan_id;

  insert into public.meal_plan_versions (
    meal_plan_id, client_id, user_id, version_number, source, status,
    content, orientations, needs_review, created_by, parent_version_id, ai_metadata, metadata
  ) values (
    v_plan_id, p_client_id, v_owner, v_next, p_source, p_status,
    coalesce(p_content, '{}'::jsonb), p_orientations, coalesce(p_needs_review, false),
    auth.uid(), p_parent_version_id, coalesce(p_ai_metadata, '{}'::jsonb), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  insert into public.operational_events (user_id, client_id, entity_type, entity_id, event_type, metadata)
  values (v_owner, p_client_id, 'meal_plan_version', v_id, 'meal_plan_version_created',
          jsonb_build_object('source', p_source, 'version_number', v_next));

  return v_id;
end;
$$;

-- ============ RPC: publicar versão (transacional) ============
create or replace function public.publish_meal_plan_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.meal_plan_versions%rowtype;
  v_owner uuid;
  v_prev uuid;
begin
  select * into v_row from public.meal_plan_versions where id = p_version_id;
  if v_row.id is null then raise exception 'Versão não encontrada'; end if;

  select user_id into v_owner from public.clients where id = v_row.client_id;
  if auth.uid() is distinct from v_owner then
    raise exception 'Sem permissão para publicar este plano';
  end if;
  if v_row.status = 'published' then
    return jsonb_build_object('version_id', v_row.id, 'already_published', true);
  end if;
  if v_row.status in ('superseded','archived') then
    raise exception 'Versão superseded/arquivada não pode ser publicada';
  end if;
  if coalesce(jsonb_array_length(v_row.content -> 'meals'), 0) = 0
     and coalesce(v_row.content -> 'day_variations', '{}'::jsonb) = '{}'::jsonb
     and coalesce(v_row.content ->> 'text', '') = '' then
    raise exception 'Versão vazia não pode ser publicada';
  end if;

  update public.meal_plan_versions
     set status = 'superseded', superseded_at = now()
   where meal_plan_id = v_row.meal_plan_id and status = 'published'
  returning id into v_prev;

  update public.meal_plan_versions
     set status = 'published', published_at = now(), needs_review = false
   where id = v_row.id;

  update public.meal_plans
     set current_version_id = v_row.id, updated_at = now()
   where id = v_row.meal_plan_id;

  insert into public.meal_plan_status (client_id, user_id, status, sent_at)
  values (v_row.client_id, v_owner, 'sent', now())
  on conflict (client_id) do update set status = 'sent', sent_at = now(), updated_at = now();

  if v_prev is not null then
    insert into public.operational_events (user_id, client_id, entity_type, entity_id, event_type, metadata)
    values (v_owner, v_row.client_id, 'meal_plan_version', v_prev, 'meal_plan_superseded',
            jsonb_build_object('replaced_by', v_row.id));
  end if;

  insert into public.operational_events (user_id, client_id, entity_type, entity_id, event_type, metadata)
  values (v_owner, v_row.client_id, 'meal_plan_version', v_row.id, 'meal_plan_published',
          jsonb_build_object('version_number', v_row.version_number, 'source', v_row.source));

  return jsonb_build_object('version_id', v_row.id, 'previous_version_id', v_prev,
                            'version_number', v_row.version_number, 'published_at', now());
end;
$$;

grant execute on function public.create_meal_plan_version(uuid, jsonb, text, jsonb, text, uuid, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.publish_meal_plan_version(uuid) to authenticated;