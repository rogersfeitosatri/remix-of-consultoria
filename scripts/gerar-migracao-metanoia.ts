/**
 * Gera a migração que cria o formulário único do Metanóia e o plano em
 * onboarding_plans. Roda com esbuild (npm run gerar:metanoia) e escreve o SQL
 * em stdout. A migração gerada é versionada: este script existe para a
 * lista de perguntas ter uma única fonte (src/lib/metanoiaAnamnese.ts).
 */
import { montarPerguntasMetanoia, METANOIA_FORM_DESCRIPTION } from '../src/lib/metanoiaAnamnese';
import { METANOIA_FORM_ID, METANOIA_FORM_TITLE, METANOIA_PLAN_SLUG } from '../src/lib/metanoia';

const OWNER = 'c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b';

const CANONICO: Record<string, string> = {
  text: 'short_text', textarea: 'long_text', number: 'number', select: 'single_select',
  multiselect: 'multi_select', scale: 'scale', boolean: 'boolean', date: 'date', time: 'time', info: 'info',
};

const lit = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown) => (v == null ? 'null' : `${lit(JSON.stringify(v))}::jsonb`);
const bool = (v: unknown) => (v ? 'true' : 'false');
const num = (v: number | null | undefined) => (v == null ? 'null' : String(v));

const perguntas = montarPerguntasMetanoia();
const linhas = perguntas.map((q, i) => {
  const dominio = q.question_key.startsWith('aval_') ? 'comportamental' : null;
  return `      (v_form, ${lit(q.section)}, ${lit(q.question_text)}, ${lit(q.question_type)}, ${lit(CANONICO[q.question_type] ?? null)}, ${lit(q.question_key)}, ${json(q.options ?? null)}, ${num(q.scale_min)}, ${num(q.scale_max)}, ${bool(q.is_required)}, ${i}, ${bool(q.has_comment_field)}, ${lit(q.comment_field_label ?? null)}, false, ${json(q.conditional_logic ?? null)}, ${json(q.config ?? null)}, ${lit(dominio)})`;
});

const sql = `-- Metanóia: o formulário único do programa e o plano de onboarding.
--
-- Gerado por scripts/gerar-migracao-metanoia.ts a partir de
-- src/lib/metanoiaAnamnese.ts (Anamnese Completa + blocos do app + seção
-- comportamental). Não edite as perguntas aqui: mude a fonte e gere de novo.
--
-- Idempotente: só grava o que ainda não existe. Num banco montado do zero o
-- dono não existe em auth.users e o bloco de conteúdo é pulado.

alter table public.clients add column if not exists asaas_payment_link_id text;
alter table public.clients add column if not exists asaas_payment_link_url text;
create index if not exists clients_asaas_payment_link_id_idx
  on public.clients (asaas_payment_link_id) where asaas_payment_link_id is not null;

do $$
declare
  v_owner uuid := '${OWNER}';
  v_form  uuid := '${METANOIA_FORM_ID}';
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    raise notice 'metanoia: dono % ausente neste banco, conteúdo não semeado', v_owner;
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 1. O plano, fora da vitrine (/plans lista só os ativos). O checkout lê pelo slug.
  if not exists (select 1 from public.onboarding_plans where slug = ${lit(METANOIA_PLAN_SLUG)}) then
    insert into public.onboarding_plans
      (slug, category, periodicity, name, description, duration_months, consultations_count, consultation_interval_weeks, checkin_frequency, payment_link, price, order_index, is_active)
    values
      (${lit(METANOIA_PLAN_SLUG)}, 'consultas', 'trimestral', 'Metanóia', 'Programa de 12 semanas de comportamento alimentar para corredores: 3 consultas, Pausa da Semana e acompanhamento no WhatsApp.', 3, 3, 4, 'weekly', null, 1297.00, 100, false);
  end if;

  -- 2. O formulário único, com id fixo, publicado como a tela publicaria.
  if not exists (select 1 from public.anamnese_forms where id = v_form) then
    insert into public.anamnese_forms (id, user_id, title, description, is_active)
    values (v_form, v_owner, ${lit(METANOIA_FORM_TITLE)}, ${lit(METANOIA_FORM_DESCRIPTION)}, true);

    insert into public.anamnese_questions
      (form_id, section, question_text, question_type, canonical_type, question_key, options, scale_min, scale_max, is_required, order_index, has_comment_field, comment_field_label, comment_field_required, conditional_logic, config, domain)
    values
${linhas.join(',\n')};

    perform public.publish_anamnese_form_version(v_form, 'Metanóia: Anamnese Completa, blocos do app e seção comportamental, versão inicial');
  end if;
end $$;
`;

process.stdout.write(sql);
