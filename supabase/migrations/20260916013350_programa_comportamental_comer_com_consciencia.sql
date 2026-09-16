-- Programa de acompanhamento comportamental "Comer com Consciência".
--
-- Cria, para o nutricionista dono do sistema:
--   1. as perguntas no banco de perguntas, na categoria "comportamental";
--   2. a anamnese "Avaliação comportamental" (7 notas de 0 a 10 + 3 abertas),
--      aplicada antes de cada consulta e no encerramento;
--   3. o check-in semanal (12 perguntas abertas), com devolutiva do nutri.
--
-- As duas formas nascem PUBLICADAS pela mesma função que a tela usa
-- (publish_*_form_version). Para isso o bloco assume a identidade do dono,
-- como faria a sessão dele no app: created_by e published_by ficam certos.
--
-- Idempotente: cada bloco só grava se ainda não existir. Num banco montado do
-- zero o dono não existe em auth.users e o bloco inteiro é pulado — o schema
-- vem das migrações anteriores; isto aqui é conteúdo.

do $$
declare
  v_owner uuid := 'c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b';
  v_anam  uuid;
  v_chk   uuid;
  v_abertura_avaliacao text := 'Responda pensando nas últimas duas semanas. Não existe nota boa ou ruim. O objetivo é a gente comparar como você estava no começo e como está agora.';
  v_abertura_checkin   text := 'Este formulário é um espaço de acolhimento para você expressar livremente como foi sua semana com a comida. Suas respostas me ajudarão a compreender melhor seu momento e oferecer devolutivas personalizadas que contribuam para o seu processo.';
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    raise notice 'programa comportamental: dono % ausente neste banco, conteúdo não semeado', v_owner;
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  ---------------------------------------------------------------------------
  -- 1. Banco de perguntas · categoria "comportamental"
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.question_templates where user_id = v_owner and category = 'comportamental') then
    insert into public.question_templates
      (user_id, category, section, question_text, question_type, canonical_type, scale_min, scale_max, is_required, question_key, domain, has_comment_field, comment_field_required)
    select v_owner, 'comportamental', v.section, v.texto, v.tipo, v.canonico, v.mn, v.mx, v.obrig, v.chave, 'comportamental', false, false
    from (values
      -- Avaliação (antes de cada consulta e no encerramento)
      ('anamnese', 'Quanto você entende hoje por que come do jeito que come?',                                     'scale',    'scale',     0, 10, true,  'aval_entende_por_que_come'),
      ('anamnese', 'Quanto você sente que está no controle das suas escolhas com a comida?',                       'scale',    'scale',     0, 10, true,  'aval_controle_escolhas'),
      ('anamnese', 'Quanto a comida ocupa a sua cabeça em um dia comum?',                                          'scale',    'scale',     0, 10, true,  'aval_comida_na_cabeca'),
      ('anamnese', 'Quanto de culpa você sente depois de comer algo fora do que planejou?',                        'scale',    'scale',     0, 10, true,  'aval_culpa'),
      ('anamnese', 'Quanto você confia que consegue manter o que conquistou sem depender de ninguém?',             'scale',    'scale',     0, 10, true,  'aval_autonomia'),
      ('anamnese', 'Quanto o seu comer está te ajudando a treinar e a se recuperar bem?',                          'scale',    'scale',     0, 10, true,  'aval_comer_e_treino'),
      ('anamnese', 'Como está a sua relação com o seu corpo e com o seu peso?',                                    'scale',    'scale',     0, 10, true,  'aval_corpo_e_peso'),
      ('anamnese', 'Em uma frase, como você descreveria a sua relação com a comida hoje?',                         'textarea', 'long_text', null, null, false, 'aval_relacao_em_uma_frase'),
      ('anamnese', 'O que mudou desde a última avaliação? (na primeira vez: o que te trouxe ao programa?)',        'textarea', 'long_text', null, null, false, 'aval_o_que_mudou'),
      ('anamnese', 'O que você ainda gostaria que fosse diferente?',                                               'textarea', 'long_text', null, null, false, 'aval_o_que_falta'),
      -- Check-in semanal
      ('checkin', 'Como você descreveria a sua semana com a comida?',                                                                                          'textarea', 'long_text', null, null, true,  'ci_semana_com_a_comida'),
      ('checkin', 'Quais foram os principais acontecimentos que impactaram o seu comer nos últimos dias?',                                                     'textarea', 'long_text', null, null, true,  'ci_acontecimentos'),
      ('checkin', 'Quais sentimentos estiveram mais presentes na hora de comer esta semana? (ansiedade, cansaço, culpa, prazer, tranquilidade etc.)',           'textarea', 'long_text', null, null, true,  'ci_sentimentos'),
      ('checkin', 'Houve algum pensamento sobre comida, corpo ou peso que ficou se repetindo ou te incomodando bastante? Se sim, qual?',                       'textarea', 'long_text', null, null, true,  'ci_pensamentos_repetidos'),
      ('checkin', 'Teve alguma situação em que você sentiu dificuldade de lidar com a vontade de comer? Como reagiu?',                                         'textarea', 'long_text', null, null, true,  'ci_vontade_de_comer'),
      ('checkin', 'Como foi a sua relação consigo mesmo(a) depois de comer nesta semana?',                                                                     'textarea', 'long_text', null, null, true,  'ci_relacao_consigo'),
      ('checkin', 'Como você percebeu a comida nas suas interações com outras pessoas (família, amigos, trabalho)?',                                           'textarea', 'long_text', null, null, true,  'ci_interacoes'),
      ('checkin', 'Conseguiu colocar em prática as orientações ou atividades propostas na semana passada? Como foi?',                                          'textarea', 'long_text', null, null, true,  'ci_atividade_da_semana'),
      ('checkin', 'Qual foi a MAIOR dificuldade que você enfrentou com a comida nos últimos dias?',                                                            'textarea', 'long_text', null, null, true,  'ci_maior_dificuldade'),
      ('checkin', 'O que funcionou bem e você gostaria de repetir?',                                                                                           'textarea', 'long_text', null, null, true,  'ci_o_que_funcionou'),
      ('checkin', 'O que gostaria de trabalhar ou ter mais apoio nesta próxima semana?',                                                                       'textarea', 'long_text', null, null, true,  'ci_proxima_semana'),
      ('checkin', 'Tem mais alguma informação que você gostaria de acrescentar?',                                                                              'textarea', 'long_text', null, null, false, 'ci_mais_alguma_coisa')
    ) as v(section, texto, tipo, canonico, mn, mx, obrig, chave);
  end if;

  ---------------------------------------------------------------------------
  -- 2. Anamnese · "Como você está com a comida hoje"
  --    Tipos legados (scale / textarea): são os que o renderizador da anamnese
  --    reconhece; o canônico vai junto para a versão publicada.
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.anamnese_forms where user_id = v_owner and title = 'Comer com Consciência — Avaliação comportamental') then
    insert into public.anamnese_forms (user_id, title, description, is_active, presentation_mode)
    values (v_owner, 'Comer com Consciência — Avaliação comportamental', v_abertura_avaliacao, true, 'standard')
    returning id into v_anam;

    insert into public.anamnese_questions
      (form_id, section, question_text, question_type, canonical_type, scale_min, scale_max, is_required, order_index, question_key, domain, has_comment_field, comment_field_required)
    select v_anam, v.secao, v.texto, v.tipo, v.canonico, v.mn, v.mx, v.obrig, v.ordem, v.chave, 'comportamental', false, false
    from (values
      ('Notas de 0 a 10', 'Quanto você entende hoje por que come do jeito que come?',                              'scale',    'scale',     0, 10, true,  0, 'aval_entende_por_que_come'),
      ('Notas de 0 a 10', 'Quanto você sente que está no controle das suas escolhas com a comida?',                'scale',    'scale',     0, 10, true,  1, 'aval_controle_escolhas'),
      ('Notas de 0 a 10', 'Quanto a comida ocupa a sua cabeça em um dia comum?',                                   'scale',    'scale',     0, 10, true,  2, 'aval_comida_na_cabeca'),
      ('Notas de 0 a 10', 'Quanto de culpa você sente depois de comer algo fora do que planejou?',                 'scale',    'scale',     0, 10, true,  3, 'aval_culpa'),
      ('Notas de 0 a 10', 'Quanto você confia que consegue manter o que conquistou sem depender de ninguém?',      'scale',    'scale',     0, 10, true,  4, 'aval_autonomia'),
      ('Notas de 0 a 10', 'Quanto o seu comer está te ajudando a treinar e a se recuperar bem?',                   'scale',    'scale',     0, 10, true,  5, 'aval_comer_e_treino'),
      ('Notas de 0 a 10', 'Como está a sua relação com o seu corpo e com o seu peso?',                             'scale',    'scale',     0, 10, true,  6, 'aval_corpo_e_peso'),
      ('Em suas palavras', 'Em uma frase, como você descreveria a sua relação com a comida hoje?',                 'textarea', 'long_text', null, null, false, 7, 'aval_relacao_em_uma_frase'),
      ('Em suas palavras', 'O que mudou desde a última avaliação? (na primeira vez: o que te trouxe ao programa?)','textarea', 'long_text', null, null, false, 8, 'aval_o_que_mudou'),
      ('Em suas palavras', 'O que você ainda gostaria que fosse diferente?',                                       'textarea', 'long_text', null, null, false, 9, 'aval_o_que_falta')
    ) as v(secao, texto, tipo, canonico, mn, mx, obrig, ordem, chave);

    perform public.publish_anamnese_form_version(v_anam, 'Programa Comer com Consciência — avaliação aplicada antes de cada consulta e no encerramento');
  end if;

  ---------------------------------------------------------------------------
  -- 3. Check-in semanal · 12 perguntas abertas
  --    O atleta já é identificado pelo envio; a pergunta "Qual o seu nome?"
  --    do Google Forms não é necessária aqui.
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.checkin_forms where user_id = v_owner and title = 'Check-in comportamental — Comer com Consciência') then
    insert into public.checkin_forms (user_id, title, description, is_active, is_periodization)
    values (v_owner, 'Check-in comportamental — Comer com Consciência', v_abertura_checkin, true, false)
    returning id into v_chk;

    insert into public.checkin_questions
      (form_id, question_text, question_type, canonical_type, is_required, order_index, question_key, domain, has_comment_field, comment_field_required)
    select v_chk, v.texto, 'long_text', 'long_text', v.obrig, v.ordem, v.chave, 'comportamental', false, false
    from (values
      ('Como você descreveria a sua semana com a comida?',                                                                                    true,  0,  'ci_semana_com_a_comida'),
      ('Quais foram os principais acontecimentos que impactaram o seu comer nos últimos dias?',                                               true,  1,  'ci_acontecimentos'),
      ('Quais sentimentos estiveram mais presentes na hora de comer esta semana? (ansiedade, cansaço, culpa, prazer, tranquilidade etc.)',     true,  2,  'ci_sentimentos'),
      ('Houve algum pensamento sobre comida, corpo ou peso que ficou se repetindo ou te incomodando bastante? Se sim, qual?',                 true,  3,  'ci_pensamentos_repetidos'),
      ('Teve alguma situação em que você sentiu dificuldade de lidar com a vontade de comer? Como reagiu?',                                   true,  4,  'ci_vontade_de_comer'),
      ('Como foi a sua relação consigo mesmo(a) depois de comer nesta semana?',                                                               true,  5,  'ci_relacao_consigo'),
      ('Como você percebeu a comida nas suas interações com outras pessoas (família, amigos, trabalho)?',                                     true,  6,  'ci_interacoes'),
      ('Conseguiu colocar em prática as orientações ou atividades propostas na semana passada? Como foi?',                                    true,  7,  'ci_atividade_da_semana'),
      ('Qual foi a MAIOR dificuldade que você enfrentou com a comida nos últimos dias?',                                                      true,  8,  'ci_maior_dificuldade'),
      ('O que funcionou bem e você gostaria de repetir?',                                                                                     true,  9,  'ci_o_que_funcionou'),
      ('O que gostaria de trabalhar ou ter mais apoio nesta próxima semana?',                                                                 true,  10, 'ci_proxima_semana'),
      ('Tem mais alguma informação que você gostaria de acrescentar?',                                                                        false, 11, 'ci_mais_alguma_coisa')
    ) as v(texto, obrig, ordem, chave);

    perform public.publish_checkin_form_version(v_chk, 'Programa Comer com Consciência — check-in semanal com devolutiva individual');
  end if;
end $$;
