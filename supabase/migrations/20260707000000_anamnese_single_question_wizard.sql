-- Formulário de anamnese em modo "wizard" com 1 pergunta por tela.
alter table public.anamnese_forms
  add column if not exists single_question_wizard boolean not null default false;

comment on column public.anamnese_forms.single_question_wizard is
  'Quando true, a anamnese é exibida ao atleta como wizard de 1 pergunta por tela (refeições e dias de treino em telas separadas).';
