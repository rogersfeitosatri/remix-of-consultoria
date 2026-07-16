-- Remove o subcampo "horario_largada" (e variações) do config da pergunta prova_alvo
UPDATE public.anamnese_questions
SET config = jsonb_set(
  config,
  '{fields}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(config->'fields') elem
      WHERE COALESCE(elem->>'key','') NOT IN ('horario_largada','horario_da_largada','start_time','horario')
        AND lower(COALESCE(elem->>'label','')) NOT LIKE '%horário da largada%'
        AND lower(COALESCE(elem->>'label','')) NOT LIKE '%horario da largada%'
    ),
    '[]'::jsonb
  )
)
WHERE question_key = 'prova_alvo'
  AND question_type = 'field_group'
  AND config ? 'fields';