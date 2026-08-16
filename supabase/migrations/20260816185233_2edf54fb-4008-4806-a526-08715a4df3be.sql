-- ETAPA 3A — Versão publicada é imutável (só muda de status ao ser substituída)
create or replace function public.guard_published_meal_plan_version()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'published' then
    if new.content is distinct from old.content
       or new.orientations is distinct from old.orientations
       or new.version_number is distinct from old.version_number
       or new.client_id is distinct from old.client_id then
      raise exception 'Versão publicada é imutável. Crie uma nova versão para alterar o plano.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_published_meal_plan_version on public.meal_plan_versions;
create trigger trg_guard_published_meal_plan_version
before update on public.meal_plan_versions
for each row execute function public.guard_published_meal_plan_version();