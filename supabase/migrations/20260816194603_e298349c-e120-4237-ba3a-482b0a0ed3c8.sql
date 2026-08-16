-- ETAPA 3C — migração semântica da condicional de longão (conservadora)

-- 1) Camada de compatibilidade semântica (não altera versões imutáveis)
CREATE TABLE IF NOT EXISTS public.form_question_semantics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_question_id uuid NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'checkin',
  question_key text,
  conditional_logic jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.form_question_semantics TO anon;
GRANT SELECT ON public.form_question_semantics TO authenticated;
GRANT ALL ON public.form_question_semantics TO service_role;

ALTER TABLE public.form_question_semantics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Semantics readable by anyone" ON public.form_question_semantics;
CREATE POLICY "Semantics readable by anyone"
  ON public.form_question_semantics FOR SELECT USING (true);

-- 2) Perguntas vivas: apenas metadados semânticos (texto/tipo/opções intactos)
UPDATE public.checkin_questions
SET question_key = 'did_long_run',
    domain = COALESCE(domain, 'training'),
    canonical_type = COALESCE(canonical_type, 'boolean_choice')
WHERE id = 'c0c4d449-5a03-4501-9e0c-008709e3ab0e';

UPDATE public.checkin_questions
SET conditional_logic = jsonb_build_object(
      'depends_on', 'did_long_run',
      'operator', 'equals',
      'value', 'Sim'
    )
WHERE id IN (
  '0ddb5132-af72-42a9-a2cc-678ea1b347df',
  '06c7d182-ee93-4f67-86d1-7871df7777a4'
);

-- Caso ambíguo: pergunta sobre treinos intensos que cita "longão".
-- Não migrar. Marcar para revisão manual (segue no fallback legado).
UPDATE public.checkin_questions
SET semantic_review_required = true
WHERE id = '1b783d4c-66b3-4351-bf7e-f69e811d4fdb';

-- 3) Mapa de compatibilidade para versões congeladas (histórico intacto)
INSERT INTO public.form_question_semantics (source_question_id, scope, question_key, conditional_logic, notes)
VALUES
  ('c0c4d449-5a03-4501-9e0c-008709e3ab0e', 'checkin', 'did_long_run', NULL, 'Gatilho inequívoco do treino longo'),
  ('0ddb5132-af72-42a9-a2cc-678ea1b347df', 'checkin', NULL, '{"depends_on":"did_long_run","operator":"equals","value":"Sim"}'::jsonb, 'Dependente inequívoca'),
  ('06c7d182-ee93-4f67-86d1-7871df7777a4', 'checkin', NULL, '{"depends_on":"did_long_run","operator":"equals","value":"Sim"}'::jsonb, 'Suplementação do treino longo (sequencial ao gatilho)')
ON CONFLICT (source_question_id) DO UPDATE
  SET question_key = EXCLUDED.question_key,
      conditional_logic = EXCLUDED.conditional_logic,
      notes = EXCLUDED.notes;