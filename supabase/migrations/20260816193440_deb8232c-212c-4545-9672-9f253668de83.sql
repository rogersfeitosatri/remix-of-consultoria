-- ETAPA 3C — FORMULÁRIOS VERSIONADOS + BANCO DE PERGUNTAS SEMÂNTICO
create table if not exists public.form_migration_report (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  scope text not null,
  metric text not null,
  value numeric,
  details jsonb not null default '{}'::jsonb
);
grant select on public.form_migration_report to authenticated;
grant all on public.form_migration_report to service_role;
alter table public.form_migration_report enable row level security;
drop policy if exists "Admins read form migration report" on public.form_migration_report;
create policy "Admins read form migration report"
  on public.form_migration_report for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

insert into public.form_migration_report (scope, metric, value, details)
select 'checkin', 'forms_total', count(*), '{}'::jsonb from public.checkin_forms
union all select 'checkin', 'forms_active', count(*), '{}'::jsonb from public.checkin_forms where is_active
union all select 'checkin', 'questions_total', count(*), '{}'::jsonb from public.checkin_questions
union all select 'checkin', 'responses_total', count(*), '{}'::jsonb from public.checkin_responses
union all select 'checkin', 'forms_with_responses', count(distinct form_id), '{}'::jsonb from public.checkin_responses
union all select 'checkin', 'dispatches_total', count(*), '{}'::jsonb from public.checkin_dispatches
union all select 'checkin', 'schedules_total', count(*), '{}'::jsonb from public.athlete_checkin_schedules
union all select 'anamnese', 'forms_total', count(*), '{}'::jsonb from public.anamnese_forms
union all select 'anamnese', 'questions_total', count(*), '{}'::jsonb from public.anamnese_questions
union all select 'anamnese', 'questions_with_key', count(*), '{}'::jsonb from public.anamnese_questions where question_key is not null
union all select 'anamnese', 'responses_total', count(*), '{}'::jsonb from public.anamnese_responses
union all select 'bank', 'templates_total', count(*), '{}'::jsonb from public.question_templates;

insert into public.form_migration_report (scope, metric, value, details)
select 'checkin', 'form_detail', (select count(*) from public.checkin_responses r where r.form_id = f.id),
       jsonb_build_object('form_id', f.id, 'title', f.title, 'is_active', f.is_active,
         'questions', (select count(*) from public.checkin_questions q where q.form_id = f.id),
         'dispatches', (select count(*) from public.checkin_dispatches d where d.checkin_form_id = f.id),
         'schedules', (select count(*) from public.athlete_checkin_schedules s where s.checkin_form_id = f.id))
from public.checkin_forms f
union all
select 'anamnese', 'form_detail', (select count(*) from public.anamnese_responses r where r.form_id = a.id),
       jsonb_build_object('form_id', a.id, 'title', a.title, 'is_active', a.is_active,
         'questions', (select count(*) from public.anamnese_questions q where q.form_id = a.id))
from public.anamnese_forms a;

create or replace function public.canonical_question_type(p_type text)
returns text language sql immutable set search_path = public as $$
  select case lower(coalesce(p_type, ''))
    when 'text' then 'short_text'
    when 'short_text' then 'short_text'
    when 'textarea' then 'long_text'
    when 'long_text' then 'long_text'
    when 'number' then 'number'
    when 'multiple_choice' then 'single_select'
    when 'select' then 'single_select'
    when 'radio' then 'single_select'
    when 'checkbox' then 'multi_select'
    when 'multiselect' then 'multi_select'
    when 'multi_select' then 'multi_select'
    when 'scale' then 'scale'
    when 'symptom_scale' then 'scale'
    when 'boolean' then 'boolean'
    when 'date' then 'date'
    when 'time' then 'time'
    when 'info' then 'info'
    when '' then 'unknown'
    else 'extension:' || lower(p_type)
  end
$$;

alter table public.question_templates
  add column if not exists question_key text,
  add column if not exists metric_key text,
  add column if not exists domain text,
  add column if not exists unit text,
  add column if not exists canonical_type text,
  add column if not exists is_adjustment_trigger boolean not null default false,
  add column if not exists conditional_logic jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists semantic_review_required boolean not null default false;

alter table public.checkin_questions
  add column if not exists question_key text,
  add column if not exists metric_key text,
  add column if not exists domain text,
  add column if not exists unit text,
  add column if not exists canonical_type text,
  add column if not exists is_adjustment_trigger boolean not null default false,
  add column if not exists conditional_logic jsonb,
  add column if not exists config jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists semantic_review_required boolean not null default false;

alter table public.anamnese_questions
  add column if not exists metric_key text,
  add column if not exists domain text,
  add column if not exists unit text,
  add column if not exists canonical_type text,
  add column if not exists is_adjustment_trigger boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists semantic_review_required boolean not null default false;

update public.question_templates set canonical_type = public.canonical_question_type(question_type) where canonical_type is null;
update public.checkin_questions set canonical_type = public.canonical_question_type(question_type) where canonical_type is null;
update public.anamnese_questions set canonical_type = public.canonical_question_type(question_type) where canonical_type is null;

alter table public.checkin_forms
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists current_version_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.checkin_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.checkin_forms(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  title text,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (form_id, version_number)
);

create table if not exists public.checkin_form_version_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.checkin_form_versions(id) on delete cascade,
  source_question_id uuid,
  order_index integer not null default 0,
  question_text text not null,
  question_type text not null,
  canonical_type text not null,
  options jsonb,
  scale_min integer,
  scale_max integer,
  is_required boolean not null default false,
  has_comment_field boolean not null default false,
  comment_field_label text,
  comment_field_required boolean not null default false,
  question_key text,
  metric_key text,
  domain text,
  unit text,
  is_adjustment_trigger boolean not null default false,
  conditional_logic jsonb,
  config jsonb,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_ckfv_form on public.checkin_form_versions(form_id);
create index if not exists idx_ckfvq_version on public.checkin_form_version_questions(version_id, order_index);

grant select, insert, update, delete on public.checkin_form_versions to authenticated;
grant all on public.checkin_form_versions to service_role;
grant select on public.checkin_form_versions to anon;
grant select, insert, update, delete on public.checkin_form_version_questions to authenticated;
grant all on public.checkin_form_version_questions to service_role;
grant select on public.checkin_form_version_questions to anon;
alter table public.checkin_form_versions enable row level security;
alter table public.checkin_form_version_questions enable row level security;

drop policy if exists "Owners manage checkin form versions" on public.checkin_form_versions;
create policy "Owners manage checkin form versions" on public.checkin_form_versions
  for all to authenticated
  using (exists (select 1 from public.checkin_forms f where f.id = form_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.checkin_forms f where f.id = form_id and f.user_id = auth.uid()));
drop policy if exists "Public reads published checkin versions" on public.checkin_form_versions;
create policy "Public reads published checkin versions" on public.checkin_form_versions
  for select to anon, authenticated using (status in ('published','superseded'));
drop policy if exists "Owners manage checkin version questions" on public.checkin_form_version_questions;
create policy "Owners manage checkin version questions" on public.checkin_form_version_questions
  for all to authenticated
  using (exists (select 1 from public.checkin_form_versions v join public.checkin_forms f on f.id = v.form_id where v.id = version_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.checkin_form_versions v join public.checkin_forms f on f.id = v.form_id where v.id = version_id and f.user_id = auth.uid()));
drop policy if exists "Public reads published checkin version questions" on public.checkin_form_version_questions;
create policy "Public reads published checkin version questions" on public.checkin_form_version_questions
  for select to anon, authenticated
  using (exists (select 1 from public.checkin_form_versions v where v.id = version_id and v.status in ('published','superseded')));

alter table public.anamnese_forms
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists current_version_id uuid,
  add column if not exists presentation_mode text not null default 'standard',
  add column if not exists model_kind text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.anamnese_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.anamnese_forms(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  title text,
  description text,
  presentation_mode text not null default 'standard',
  created_at timestamptz not null default now(),
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (form_id, version_number)
);

create table if not exists public.anamnese_form_version_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.anamnese_form_versions(id) on delete cascade,
  source_question_id uuid,
  order_index integer not null default 0,
  section text,
  subsection text,
  question_text text not null,
  question_type text not null,
  canonical_type text not null,
  options jsonb,
  scale_min integer,
  scale_max integer,
  is_required boolean not null default false,
  has_comment_field boolean not null default false,
  comment_field_label text,
  comment_field_required boolean not null default false,
  question_key text,
  metric_key text,
  domain text,
  unit text,
  is_adjustment_trigger boolean not null default false,
  conditional_logic jsonb,
  config jsonb,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_anfv_form on public.anamnese_form_versions(form_id);
create index if not exists idx_anfvq_version on public.anamnese_form_version_questions(version_id, order_index);

grant select, insert, update, delete on public.anamnese_form_versions to authenticated;
grant all on public.anamnese_form_versions to service_role;
grant select on public.anamnese_form_versions to anon;
grant select, insert, update, delete on public.anamnese_form_version_questions to authenticated;
grant all on public.anamnese_form_version_questions to service_role;
grant select on public.anamnese_form_version_questions to anon;
alter table public.anamnese_form_versions enable row level security;
alter table public.anamnese_form_version_questions enable row level security;

drop policy if exists "Owners manage anamnese form versions" on public.anamnese_form_versions;
create policy "Owners manage anamnese form versions" on public.anamnese_form_versions
  for all to authenticated
  using (exists (select 1 from public.anamnese_forms f where f.id = form_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.anamnese_forms f where f.id = form_id and f.user_id = auth.uid()));
drop policy if exists "Public reads published anamnese versions" on public.anamnese_form_versions;
create policy "Public reads published anamnese versions" on public.anamnese_form_versions
  for select to anon, authenticated using (status in ('published','superseded'));
drop policy if exists "Owners manage anamnese version questions" on public.anamnese_form_version_questions;
create policy "Owners manage anamnese version questions" on public.anamnese_form_version_questions
  for all to authenticated
  using (exists (select 1 from public.anamnese_form_versions v join public.anamnese_forms f on f.id = v.form_id where v.id = version_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.anamnese_form_versions v join public.anamnese_forms f on f.id = v.form_id where v.id = version_id and f.user_id = auth.uid()));
drop policy if exists "Public reads published anamnese version questions" on public.anamnese_form_version_questions;
create policy "Public reads published anamnese version questions" on public.anamnese_form_version_questions
  for select to anon, authenticated
  using (exists (select 1 from public.anamnese_form_versions v where v.id = version_id and v.status in ('published','superseded')));

alter table public.checkin_responses
  add column if not exists form_version_id uuid references public.checkin_form_versions(id),
  add column if not exists questions_snapshot jsonb,
  add column if not exists needs_form_version_review boolean not null default false;
alter table public.anamnese_responses
  add column if not exists form_version_id uuid references public.anamnese_form_versions(id),
  add column if not exists questions_snapshot jsonb,
  add column if not exists needs_form_version_review boolean not null default false;
alter table public.checkin_dispatches
  add column if not exists form_version_id uuid references public.checkin_form_versions(id);
alter table public.athlete_checkin_schedules
  add column if not exists checkin_form_version_policy text not null default 'current';

alter table public.plan_templates
  add column if not exists checkin_form_id uuid references public.checkin_forms(id),
  add column if not exists anamnese_form_id uuid references public.anamnese_forms(id);

create table if not exists public.athlete_checkin_form_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  checkin_form_id uuid not null references public.checkin_forms(id),
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  removed_at timestamptz,
  removed_by uuid
);
create unique index if not exists uq_active_checkin_override
  on public.athlete_checkin_form_overrides(client_id) where removed_at is null;
grant select, insert, update, delete on public.athlete_checkin_form_overrides to authenticated;
grant all on public.athlete_checkin_form_overrides to service_role;
alter table public.athlete_checkin_form_overrides enable row level security;
drop policy if exists "Owners manage athlete checkin overrides" on public.athlete_checkin_form_overrides;
create policy "Owners manage athlete checkin overrides" on public.athlete_checkin_form_overrides
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.guard_immutable_form_version()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  if tg_table_name = 'checkin_form_version_questions' then
    select status into v_status from public.checkin_form_versions where id = coalesce(new.version_id, old.version_id);
  else
    select status into v_status from public.anamnese_form_versions where id = coalesce(new.version_id, old.version_id);
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'Versao publicada e imutavel. Crie uma nova versao para editar.';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_guard_ckfvq on public.checkin_form_version_questions;
create trigger trg_guard_ckfvq before insert or update or delete on public.checkin_form_version_questions
  for each row execute function public.guard_immutable_form_version();
drop trigger if exists trg_guard_anfvq on public.anamnese_form_version_questions;
create trigger trg_guard_anfvq before insert or update or delete on public.anamnese_form_version_questions
  for each row execute function public.guard_immutable_form_version();

create or replace function public.guard_form_version_row()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Versoes publicadas nao podem ser excluidas.';
    end if;
    return old;
  end if;
  if old.status in ('published','superseded') and new.status = 'draft' then
    raise exception 'Uma versao publicada nao pode voltar a rascunho.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_ckfv_row on public.checkin_form_versions;
create trigger trg_guard_ckfv_row before update or delete on public.checkin_form_versions
  for each row execute function public.guard_form_version_row();
drop trigger if exists trg_guard_anfv_row on public.anamnese_form_versions;
create trigger trg_guard_anfv_row before update or delete on public.anamnese_form_versions
  for each row execute function public.guard_form_version_row();

create or replace function public.guard_form_hard_delete()
returns trigger language plpgsql set search_path = public as $$
declare v_used boolean;
begin
  if tg_table_name = 'checkin_forms' then
    select exists (select 1 from public.checkin_responses r where r.form_id = old.id)
        or exists (select 1 from public.checkin_dispatches d where d.checkin_form_id = old.id)
        or exists (select 1 from public.athlete_checkin_schedules s where s.checkin_form_id = old.id)
      into v_used;
  else
    select exists (select 1 from public.anamnese_responses r where r.form_id = old.id) into v_used;
  end if;
  if v_used then
    raise exception 'Formulario ja utilizado nao pode ser excluido. Use Arquivar.';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_guard_delete_checkin_form on public.checkin_forms;
create trigger trg_guard_delete_checkin_form before delete on public.checkin_forms
  for each row execute function public.guard_form_hard_delete();
drop trigger if exists trg_guard_delete_anamnese_form on public.anamnese_forms;
create trigger trg_guard_delete_anamnese_form before delete on public.anamnese_forms
  for each row execute function public.guard_form_hard_delete();

create or replace function public.publish_checkin_form_version(p_form_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_form record; v_next int; v_version_id uuid;
begin
  select * into v_form from public.checkin_forms where id = p_form_id;
  if v_form is null then raise exception 'Formulario nao encontrado'; end if;
  if v_form.user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Sem permissao';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next from public.checkin_form_versions where form_id = p_form_id;
  insert into public.checkin_form_versions (form_id, version_number, status, title, description, created_by, metadata)
  values (p_form_id, v_next, 'draft', v_form.title, v_form.description, auth.uid(), jsonb_build_object('note', p_note))
  returning id into v_version_id;
  insert into public.checkin_form_version_questions (
    version_id, source_question_id, order_index, question_text, question_type, canonical_type,
    options, scale_min, scale_max, is_required, has_comment_field, comment_field_label,
    comment_field_required, question_key, metric_key, domain, unit, is_adjustment_trigger,
    conditional_logic, config, metadata)
  select v_version_id, q.id, q.order_index, q.question_text, q.question_type,
         coalesce(q.canonical_type, public.canonical_question_type(q.question_type)),
         q.options, q.scale_min, q.scale_max, q.is_required, q.has_comment_field,
         q.comment_field_label, q.comment_field_required, q.question_key, q.metric_key,
         q.domain, q.unit, q.is_adjustment_trigger, q.conditional_logic, q.config, q.metadata
  from public.checkin_questions q where q.form_id = p_form_id order by q.order_index;
  update public.checkin_form_versions set status = 'superseded', superseded_at = now()
   where form_id = p_form_id and status = 'published';
  update public.checkin_form_versions set status = 'published', published_at = now(), published_by = auth.uid()
   where id = v_version_id;
  update public.checkin_forms set current_version_id = v_version_id, updated_at = now() where id = p_form_id;
  return v_version_id;
end;
$$;

create or replace function public.publish_anamnese_form_version(p_form_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_form record; v_next int; v_version_id uuid;
begin
  select * into v_form from public.anamnese_forms where id = p_form_id;
  if v_form is null then raise exception 'Formulario nao encontrado'; end if;
  if v_form.user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Sem permissao';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next from public.anamnese_form_versions where form_id = p_form_id;
  insert into public.anamnese_form_versions (form_id, version_number, status, title, description, presentation_mode, created_by, metadata)
  values (p_form_id, v_next, 'draft', v_form.title, v_form.description, coalesce(v_form.presentation_mode,'standard'), auth.uid(), jsonb_build_object('note', p_note))
  returning id into v_version_id;
  insert into public.anamnese_form_version_questions (
    version_id, source_question_id, order_index, section, subsection, question_text, question_type,
    canonical_type, options, scale_min, scale_max, is_required, has_comment_field, comment_field_label,
    comment_field_required, question_key, metric_key, domain, unit, is_adjustment_trigger,
    conditional_logic, config, metadata)
  select v_version_id, q.id, q.order_index, q.section, q.subsection, q.question_text, q.question_type,
         coalesce(q.canonical_type, public.canonical_question_type(q.question_type)),
         q.options, q.scale_min, q.scale_max, q.is_required, q.has_comment_field,
         q.comment_field_label, q.comment_field_required, q.question_key, q.metric_key,
         q.domain, q.unit, q.is_adjustment_trigger, q.conditional_logic, q.config, q.metadata
  from public.anamnese_questions q where q.form_id = p_form_id order by q.order_index;
  update public.anamnese_form_versions set status = 'superseded', superseded_at = now()
   where form_id = p_form_id and status = 'published';
  update public.anamnese_form_versions set status = 'published', published_at = now(), published_by = auth.uid()
   where id = v_version_id;
  update public.anamnese_forms set current_version_id = v_version_id, updated_at = now() where id = p_form_id;
  return v_version_id;
end;
$$;

create or replace function public.archive_checkin_form(p_form_id uuid, p_archive boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.checkin_forms f where f.id = p_form_id
                 and (f.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))) then
    raise exception 'Sem permissao';
  end if;
  update public.checkin_forms
     set archived_at = case when p_archive then now() else null end,
         archived_by = case when p_archive then auth.uid() else null end,
         is_active = case when p_archive then false else is_active end,
         updated_at = now()
   where id = p_form_id;
end;
$$;

create or replace function public.archive_anamnese_form(p_form_id uuid, p_archive boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.anamnese_forms f where f.id = p_form_id
                 and (f.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))) then
    raise exception 'Sem permissao';
  end if;
  update public.anamnese_forms
     set archived_at = case when p_archive then now() else null end,
         archived_by = case when p_archive then auth.uid() else null end,
         is_active = case when p_archive then false else is_active end,
         updated_at = now()
   where id = p_form_id;
end;
$$;

create or replace function public.resolve_checkin_form_for_client(p_client_id uuid)
returns table(form_id uuid, form_version_id uuid, source text, error_code text)
language plpgsql stable security definer set search_path = public as $$
declare v_form uuid; v_source text; v_version uuid; v_plan text;
begin
  select o.checkin_form_id into v_form from public.athlete_checkin_form_overrides o
   where o.client_id = p_client_id and o.removed_at is null limit 1;
  if v_form is not null then v_source := 'override'; end if;

  if v_form is null then
    select c.plan_type into v_plan from public.clients c where c.id = p_client_id;
    select pt.checkin_form_id into v_form
      from public.plan_templates pt join public.clients c on c.id = p_client_id
     where pt.user_id = c.user_id and pt.checkin_form_id is not null
       and (pt.plan_type = v_plan or pt.name = v_plan)
     order by pt.order_index limit 1;
    if v_form is not null then v_source := 'plan'; end if;
  end if;

  if v_form is null then
    select s.checkin_form_id into v_form from public.athlete_checkin_schedules s
     where s.client_id = p_client_id and s.is_active = true and s.checkin_form_id is not null
     order by s.created_at limit 1;
    if v_form is not null then v_source := 'schedule'; end if;
  end if;

  if v_form is null then
    return query select null::uuid, null::uuid, null::text, 'checkin_form_not_configured'::text;
    return;
  end if;

  select f.current_version_id into v_version from public.checkin_forms f
   where f.id = v_form and f.archived_at is null;
  if v_version is null then
    select v.id into v_version from public.checkin_form_versions v
     where v.form_id = v_form and v.status = 'published'
     order by v.version_number desc limit 1;
  end if;
  if v_version is null then
    return query select v_form, null::uuid, v_source, 'checkin_form_version_not_published'::text;
    return;
  end if;
  return query select v_form, v_version, v_source, null::text;
end;
$$;

create or replace function public.get_checkin_dispatch_version(p_dispatch_token text)
returns table(dispatch_id uuid, form_id uuid, form_version_id uuid, client_id uuid)
language sql stable security definer set search_path = public as $$
  select d.id, d.checkin_form_id, d.form_version_id, d.client_id
  from public.checkin_dispatches d where d.dispatch_token = p_dispatch_token limit 1;
$$;

do $$
declare f record; v_id uuid;
begin
  for f in select * from public.checkin_forms loop
    if exists (select 1 from public.checkin_form_versions where form_id = f.id) then continue; end if;
    insert into public.checkin_form_versions (form_id, version_number, status, title, description, created_by, published_at, published_by, metadata)
    values (f.id, 1, 'draft', f.title, f.description, f.user_id, now(), f.user_id, jsonb_build_object('origin','etapa3c_backfill'))
    returning id into v_id;
    insert into public.checkin_form_version_questions (
      version_id, source_question_id, order_index, question_text, question_type, canonical_type,
      options, scale_min, scale_max, is_required, has_comment_field, comment_field_label,
      comment_field_required, question_key, metric_key, domain, unit, is_adjustment_trigger,
      conditional_logic, config, metadata)
    select v_id, q.id, q.order_index, q.question_text, q.question_type,
           coalesce(q.canonical_type, public.canonical_question_type(q.question_type)),
           q.options, q.scale_min, q.scale_max, q.is_required, q.has_comment_field,
           q.comment_field_label, q.comment_field_required, q.question_key, q.metric_key,
           q.domain, q.unit, q.is_adjustment_trigger, q.conditional_logic, q.config, q.metadata
    from public.checkin_questions q where q.form_id = f.id order by q.order_index;
    update public.checkin_form_versions set status = 'published' where id = v_id;
    update public.checkin_forms set current_version_id = v_id where id = f.id;
  end loop;

  for f in select * from public.anamnese_forms loop
    if exists (select 1 from public.anamnese_form_versions where form_id = f.id) then continue; end if;
    insert into public.anamnese_form_versions (form_id, version_number, status, title, description, presentation_mode, created_by, published_at, published_by, metadata)
    values (f.id, 1, 'draft', f.title, f.description,
            case when f.single_question_wizard or f.title ilike '%(wizard)%' or upper(f.title) like '%ANAMNESE COMPLETA%' then 'wizard' else 'standard' end,
            f.user_id, now(), f.user_id, jsonb_build_object('origin','etapa3c_backfill'))
    returning id into v_id;
    insert into public.anamnese_form_version_questions (
      version_id, source_question_id, order_index, section, subsection, question_text, question_type,
      canonical_type, options, scale_min, scale_max, is_required, has_comment_field, comment_field_label,
      comment_field_required, question_key, metric_key, domain, unit, is_adjustment_trigger,
      conditional_logic, config, metadata)
    select v_id, q.id, q.order_index, q.section, q.subsection, q.question_text, q.question_type,
           coalesce(q.canonical_type, public.canonical_question_type(q.question_type)),
           q.options, q.scale_min, q.scale_max, q.is_required, q.has_comment_field,
           q.comment_field_label, q.comment_field_required, q.question_key, q.metric_key,
           q.domain, q.unit, q.is_adjustment_trigger, q.conditional_logic, q.config, q.metadata
    from public.anamnese_questions q where q.form_id = f.id order by q.order_index;
    update public.anamnese_form_versions set status = 'published' where id = v_id;
    update public.anamnese_forms set current_version_id = v_id where id = f.id;
  end loop;
end $$;

update public.anamnese_forms set presentation_mode = 'wizard'
 where presentation_mode = 'standard'
   and (single_question_wizard = true or title ilike '%(wizard)%' or upper(title) like '%ANAMNESE COMPLETA%');

update public.anamnese_forms set model_kind = case
     when upper(title) like '%ANAMNESE COMPLETA%' then 'completa'
     when title ilike '%endurance%' then 'endurance'
     else 'padrao' end
 where model_kind is null;

update public.checkin_responses r set form_version_id = f.current_version_id
  from public.checkin_forms f
 where r.form_id = f.id and r.form_version_id is null and f.current_version_id is not null;

update public.anamnese_responses r set form_version_id = f.current_version_id
  from public.anamnese_forms f
 where r.form_id = f.id and r.form_version_id is null and f.current_version_id is not null;

update public.checkin_responses r set needs_form_version_review = true
 where exists (select 1 from public.checkin_questions q where q.form_id = r.form_id and q.created_at > r.submitted_at);

update public.anamnese_responses r set needs_form_version_review = true
 where exists (select 1 from public.anamnese_questions q where q.form_id = r.form_id and q.created_at > r.submitted_at);

update public.checkin_responses set needs_form_version_review = true where form_version_id is null;
update public.anamnese_responses set needs_form_version_review = true where form_version_id is null;

update public.checkin_dispatches d set form_version_id = f.current_version_id
  from public.checkin_forms f where d.checkin_form_id = f.id and d.form_version_id is null;

insert into public.form_migration_report (scope, metric, value, details)
select 'post', 'checkin_versions_created', count(*), '{}'::jsonb from public.checkin_form_versions
union all select 'post', 'anamnese_versions_created', count(*), '{}'::jsonb from public.anamnese_form_versions
union all select 'post', 'checkin_responses_linked', count(*), '{}'::jsonb from public.checkin_responses where form_version_id is not null
union all select 'post', 'checkin_responses_needs_review', count(*), '{}'::jsonb from public.checkin_responses where needs_form_version_review
union all select 'post', 'anamnese_responses_linked', count(*), '{}'::jsonb from public.anamnese_responses where form_version_id is not null
union all select 'post', 'anamnese_responses_needs_review', count(*), '{}'::jsonb from public.anamnese_responses where needs_form_version_review
union all select 'post', 'dispatches_linked', count(*), '{}'::jsonb from public.checkin_dispatches where form_version_id is not null;