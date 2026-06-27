-- Atualiza perguntas de refeição para o novo tipo meal_items
-- e a de rotina de treino para training_week
-- no formulário público principal (832c48e9-fe71-4577-b948-b2162c40fa52)

-- Perguntas de refeição: qualquer pergunta cujo question_text contenha referência a refeições
-- e tenha tipo textarea/long_text no formulário principal
UPDATE public.anamnese_questions
SET question_type = 'meal_items'
WHERE form_id = '832c48e9-fe71-4577-b948-b2162c40fa52'
  AND question_type IN ('textarea', 'long_text', 'text')
  AND (
    lower(question_text) LIKE '%café da manhã%'
    OR lower(question_text) LIKE '%cafe da manha%'
    OR lower(question_text) LIKE '%almoço%'
    OR lower(question_text) LIKE '%almoco%'
    OR lower(question_text) LIKE '%jantar%'
    OR lower(question_text) LIKE '%lanche%'
    OR lower(question_text) LIKE '%ceia%'
    OR lower(question_text) LIKE '%refeição%'
    OR lower(question_text) LIKE '%refeicao%'
    OR lower(question_text) LIKE '%habitual%'
    OR lower(question_text) LIKE '%come habitualmente%'
  );

-- Pergunta de rotina de treino
UPDATE public.anamnese_questions
SET question_type = 'training_week'
WHERE form_id = '832c48e9-fe71-4577-b948-b2162c40fa52'
  AND question_type IN ('textarea', 'long_text', 'text')
  AND (
    lower(question_text) LIKE '%rotina de treino%'
    OR lower(question_text) LIKE '%treino semanal%'
    OR lower(question_text) LIKE '%rotina semanal%'
    OR lower(question_text) LIKE '%semana de treino%'
  );

-- Pergunta de nível de atividade diária (se já existe como select/radio)
-- Atualiza para garantir as opções corretas
UPDATE public.anamnese_questions
SET
  question_type = 'select',
  options = '["Sedentário – fico sentado a maior parte do dia (home office, escritório)", "Pouco movimento – alterno entre ficar sentado e me movimentar", "Muito movimento – fico de pé, andando ou com esforço físico a maior parte do dia"]'::jsonb
WHERE form_id = '832c48e9-fe71-4577-b948-b2162c40fa52'
  AND (
    lower(question_text) LIKE '%atividade%dia%'
    OR lower(question_text) LIKE '%sedentari%'
    OR lower(question_text) LIKE '%dia fora%treino%'
    OR lower(question_text) LIKE '%rotina diária%'
  )
  AND question_type IN ('textarea', 'long_text', 'text', 'select');
