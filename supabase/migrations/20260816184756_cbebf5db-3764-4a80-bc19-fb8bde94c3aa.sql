-- ETAPA 3A — Backfill seguro dos planos existentes (nenhum dado legado é apagado)
create table if not exists public.meal_plan_migration_report (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id uuid,
  outcome text not null, -- migrated | needs_review | no_plan | invalid_payload
  versions_created integer not null default 0,
  published_version_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.meal_plan_migration_report to authenticated;
grant all on public.meal_plan_migration_report to service_role;
alter table public.meal_plan_migration_report enable row level security;
create policy "admin reads own migration report" on public.meal_plan_migration_report
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.try_jsonb(p_text text)
returns jsonb language plpgsql immutable set search_path = public as $$
begin
  if p_text is null or btrim(p_text) = '' then return null; end if;
  return p_text::jsonb;
exception when others then return null;
end;
$$;

do $backfill$
declare
  r record;
  v_raw jsonb;
  v_plan_id uuid;
  v_num int;
  v_created int;
  v_published uuid;
  v_active_legacy text;
  v_sent boolean;
  v_entry jsonb;
  v_vid uuid;
  v_content jsonb;
  v_map jsonb;
  v_outcome text;
begin
  for r in
    select a.client_id, a.raw_response, a.caloric_deficit, a.updated_at, a.created_at, c.user_id
    from public.ai_analyses a
    join public.clients c on c.id = a.client_id
  loop
    v_raw := public.try_jsonb(r.raw_response);
    v_created := 0; v_published := null; v_map := '{}'::jsonb;

    -- fallback: colunas legadas
    if v_raw is null then
      v_raw := coalesce(r.caloric_deficit, '{}'::jsonb);
    end if;

    v_active_legacy := v_raw ->> 'active_plan_id';
    v_sent := (v_raw ? 'zona_nutri_sent_at');

    -- nada de plano → registra e segue
    if coalesce(jsonb_array_length(v_raw #> '{meal_plan,meals}'), 0) = 0
       and coalesce(jsonb_array_length(v_raw -> 'saved_plans'), 0) = 0
       and coalesce(jsonb_array_length(v_raw -> 'attached_plans'), 0) = 0
       and coalesce(jsonb_array_length(v_raw #> '{caloric_deficit,meal_plan,meals}'), 0) = 0
       and coalesce((v_raw #> '{meal_plan,day_variations}')::text, '{}') = '{}' then
      insert into public.meal_plan_migration_report (client_id, user_id, outcome, details)
      values (r.client_id, r.user_id, 'no_plan', jsonb_build_object('reason', 'sem meal_plan/saved_plans/attached_plans'));
      continue;
    end if;

    insert into public.meal_plans (user_id, client_id)
    values (r.user_id, r.client_id)
    on conflict (client_id) do update set updated_at = now()
    returning id into v_plan_id;

    select coalesce(max(version_number), 0) into v_num
    from public.meal_plan_versions where meal_plan_id = v_plan_id;

    -- 1) saved_plans (histórico do editor)
    for v_entry in
      select value from jsonb_array_elements(coalesce(v_raw -> 'saved_plans', '[]'::jsonb))
      order by (value ->> 'savedAt') nulls first
    loop
      v_num := v_num + 1;
      insert into public.meal_plan_versions (
        meal_plan_id, client_id, user_id, version_number, source, status,
        content, orientations, created_at, metadata, needs_review
      ) values (
        v_plan_id, r.client_id, r.user_id, v_num, 'legacy_import', 'archived',
        coalesce(v_entry -> 'meal_plan', '{}'::jsonb),
        v_raw -> 'strategic_orientations',
        coalesce((v_entry ->> 'savedAt')::timestamptz, r.created_at),
        jsonb_build_object('legacy_saved_plan_id', v_entry ->> 'id', 'legacy_label', v_entry ->> 'label',
                           'legacy_sent_to_zona_nutri', coalesce((v_entry ->> 'sent_to_zona_nutri')::boolean, false)),
        false
      ) returning id into v_vid;
      v_created := v_created + 1;
      v_map := v_map || jsonb_build_object(coalesce(v_entry ->> 'id', v_vid::text), v_vid);
      if coalesce((v_entry ->> 'sent_to_zona_nutri')::boolean, false) then
        v_published := v_vid;
      end if;
    end loop;

    -- 2) plano corrente (meal_plan) quando não há saved_plans correspondentes
    if coalesce(jsonb_array_length(v_raw -> 'saved_plans'), 0) = 0
       and (coalesce(jsonb_array_length(v_raw #> '{meal_plan,meals}'), 0) > 0
            or coalesce((v_raw #> '{meal_plan,day_variations}')::text, '{}') <> '{}'
            or coalesce(jsonb_array_length(v_raw #> '{caloric_deficit,meal_plan,meals}'), 0) > 0) then
      v_num := v_num + 1;
      insert into public.meal_plan_versions (
        meal_plan_id, client_id, user_id, version_number, source, status,
        content, orientations, created_at, metadata
      ) values (
        v_plan_id, r.client_id, r.user_id, v_num, 'legacy_import', 'reviewed',
        coalesce(v_raw -> 'meal_plan', v_raw #> '{caloric_deficit,meal_plan}', '{}'::jsonb),
        v_raw -> 'strategic_orientations',
        r.updated_at,
        jsonb_build_object('legacy_source', 'ai_analyses.raw_response.meal_plan')
      ) returning id into v_vid;
      v_created := v_created + 1;
      v_published := v_vid;
    end if;

    -- 3) planos anexados (texto livre) → versões preservadas
    for v_entry in
      select value from jsonb_array_elements(coalesce(v_raw -> 'attached_plans', '[]'::jsonb))
      order by (value ->> 'savedAt') nulls first
    loop
      v_num := v_num + 1;
      v_content := jsonb_build_object('text', coalesce(v_entry ->> 'content', v_entry ->> 'text', ''));
      insert into public.meal_plan_versions (
        meal_plan_id, client_id, user_id, version_number, source, status,
        content, created_at, metadata
      ) values (
        v_plan_id, r.client_id, r.user_id, v_num, 'attached_plan', 'archived',
        v_content,
        coalesce((v_entry ->> 'savedAt')::timestamptz, (v_entry ->> 'createdAt')::timestamptz, r.created_at),
        jsonb_build_object('legacy_attached_plan_id', v_entry ->> 'id', 'legacy_label', v_entry ->> 'label')
      );
      v_created := v_created + 1;
    end loop;

    -- 4) versão publicada: só quando é possível determinar com segurança
    if v_published is null and v_active_legacy is not null and v_map ? v_active_legacy then
      v_published := (v_map ->> v_active_legacy)::uuid;
    end if;

    if v_published is not null then
      update public.meal_plan_versions
         set status = 'published',
             published_at = coalesce((v_raw ->> 'zona_nutri_sent_at')::timestamptz, r.updated_at)
       where id = v_published;
      update public.meal_plans set current_version_id = v_published where id = v_plan_id;
      -- as demais viram superseded (nunca apagadas)
      update public.meal_plan_versions
         set status = 'superseded', superseded_at = now()
       where meal_plan_id = v_plan_id and id <> v_published
         and status in ('reviewed');
      v_outcome := 'migrated';
    else
      update public.meal_plan_versions
         set needs_review = true, status = 'reviewed'
       where meal_plan_id = v_plan_id and status = 'archived'
         and version_number = v_num;
      v_outcome := 'needs_review';
    end if;

    insert into public.meal_plan_migration_report (client_id, user_id, outcome, versions_created, published_version_id, details)
    values (r.client_id, r.user_id, v_outcome, v_created, v_published,
            jsonb_build_object('legacy_active_plan_id', v_active_legacy,
                               'legacy_zona_nutri_sent', v_sent,
                               'saved_plans', coalesce(jsonb_array_length(v_raw -> 'saved_plans'), 0),
                               'attached_plans', coalesce(jsonb_array_length(v_raw -> 'attached_plans'), 0)));
  end loop;
end;
$backfill$;