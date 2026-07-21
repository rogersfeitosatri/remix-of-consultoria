
UPDATE public.anamnese_questions
SET order_index = order_index + 100
WHERE form_id = 'cdb87aff-804f-4c5f-9b90-61923317531a' AND order_index >= 20;

UPDATE public.anamnese_questions
SET order_index = order_index - 100 + 4
WHERE form_id = 'cdb87aff-804f-4c5f-9b90-61923317531a' AND order_index >= 120;

INSERT INTO public.anamnese_questions
(form_id, question_key, section, question_text, question_type, is_required, order_index, config, conditional_logic, options)
VALUES
('cdb87aff-804f-4c5f-9b90-61923317531a', 'sintomas_gi', '4. Saúde, sintomas e recuperação',
 'Sintomas gastrointestinais', 'symptom_grid', true, 17,
 '{"helper":"Para cada sintoma marcado, informe o momento (pode marcar mais de um), a frequência e a intensidade.","symptoms":["Distensão abdominal","Excesso de gases","Refluxo ou azia","Náusea","Dor abdominal","Diarreia","Constipação","Urgência para evacuar","Sensação de digestão lenta","Arroto ou regurgitação","Nenhum"],"noneOption":"Nenhum","moments":["Fora dos treinos","Antes do treino","Durante o treino","Depois do treino"],"frequencies":["Raramente","Às vezes","Frequentemente","Sempre"],"intensities":["Leve","Moderada","Forte"]}'::jsonb,
 NULL, NULL),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'diagnosticos_exames', '4. Saúde, sintomas e recuperação',
 'Diagnósticos e exames', 'field_group', true, 18,
 '{"helper":"Não interpretamos exames aqui; os arquivos são apenas armazenados com segurança para análise posterior.","fields":[{"key":"diagnosticos","label":"Você possui diagnóstico, acompanhamento médico ou exames recentes com alterações?","type":"multiselect","required":true,"options":["Anemia ou deficiência de ferro","Diabetes ou alteração da glicemia","Hipertensão","Alteração de colesterol ou triglicerídeos","Doença gastrointestinal","Doença da tireoide","Doença renal","Doença hepática","Alergia alimentar diagnosticada","Transtorno alimentar atual ou anterior","Outro diagnóstico","Não possuo","Não sei informar"]},{"key":"descricao","label":"Descrição curta","type":"textarea","show_if":{"key":"self.diagnosticos","op":"includes_any","value":["Anemia ou deficiência de ferro","Diabetes ou alteração da glicemia","Hipertensão","Alteração de colesterol ou triglicerídeos","Doença gastrointestinal","Doença da tireoide","Doença renal","Doença hepática","Alergia alimentar diagnosticada","Transtorno alimentar atual ou anterior","Outro diagnóstico"]}},{"key":"data_diagnostico","label":"Data aproximada do diagnóstico","type":"date","show_if":{"key":"self.diagnosticos","op":"includes_any","value":["Anemia ou deficiência de ferro","Diabetes ou alteração da glicemia","Hipertensão","Alteração de colesterol ou triglicerídeos","Doença gastrointestinal","Doença da tireoide","Doença renal","Doença hepática","Alergia alimentar diagnosticada","Transtorno alimentar atual ou anterior","Outro diagnóstico"]}},{"key":"data_exames","label":"Data dos exames mais recentes","type":"date","show_if":{"key":"self.diagnosticos","op":"includes_any","value":["Anemia ou deficiência de ferro","Diabetes ou alteração da glicemia","Hipertensão","Alteração de colesterol ou triglicerídeos","Doença gastrointestinal","Doença da tireoide","Doença renal","Doença hepática","Alergia alimentar diagnosticada","Transtorno alimentar atual ou anterior","Outro diagnóstico"]}},{"key":"anexos","label":"Anexar exames (opcional)","type":"file_upload"}]}'::jsonb,
 NULL, NULL),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'medicamentos', '4. Saúde, sintomas e recuperação',
 'Medicamentos', 'field_group', false, 19,
 '{"fields":[{"key":"usa","label":"Você utiliza algum medicamento de forma contínua?","type":"select","required":true,"options":["Sim","Não"]},{"key":"lista","label":"Medicamentos","type":"structured_list","addLabel":"Adicionar medicamento","show_if":{"key":"self.usa","op":"equals","value":"Sim"},"fields":[{"key":"nome","label":"Nome","type":"text","required":true},{"key":"dose","label":"Dose (se souber)","type":"text"},{"key":"horario","label":"Horário","type":"text"},{"key":"motivo","label":"Motivo de uso","type":"text"}]}]}'::jsonb,
 NULL, NULL),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'saude_recuperacao', '4. Saúde, sintomas e recuperação',
 'Saúde e recuperação', 'field_group', false, 20,
 '{"fields":[{"key":"situacoes","label":"Como está sua saúde e recuperação?","type":"multiselect","required":true,"options":["Estou lesionado","Tenho uma dor persistente","Já tive fratura por estresse","Tenho lesões recorrentes","Minha recuperação está mais lenta","Tenho dor muscular por vários dias","Fico doente com frequência","Meu desempenho caiu recentemente","Estou me recuperando normalmente","Nenhuma das opções"]},{"key":"descricao","label":"Qual é a lesão, dor ou problema?","type":"textarea","show_if":{"key":"self.situacoes","op":"includes_any","value":["Estou lesionado","Tenho uma dor persistente","Já tive fratura por estresse","Tenho lesões recorrentes","Minha recuperação está mais lenta","Tenho dor muscular por vários dias","Fico doente com frequência","Meu desempenho caiu recentemente"]}},{"key":"ha_quanto_tempo","label":"Há quanto tempo?","type":"text","show_if":{"key":"self.situacoes","op":"includes_any","value":["Estou lesionado","Tenho uma dor persistente","Já tive fratura por estresse","Tenho lesões recorrentes","Minha recuperação está mais lenta","Tenho dor muscular por vários dias","Fico doente com frequência","Meu desempenho caiu recentemente"]}},{"key":"acompanhamento","label":"Está em acompanhamento profissional?","type":"select","options":["Sim","Não"],"show_if":{"key":"self.situacoes","op":"includes_any","value":["Estou lesionado","Tenho uma dor persistente","Já tive fratura por estresse","Tenho lesões recorrentes","Minha recuperação está mais lenta","Tenho dor muscular por vários dias","Fico doente com frequência","Meu desempenho caiu recentemente"]}}]}'::jsonb,
 NULL, NULL),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'sinais_tres_meses', '4. Saúde, sintomas e recuperação',
 'Sinais percebidos nos últimos três meses', 'multiselect', false, 21,
 '{"helper":"Suas respostas geram apenas alertas internos ao nutricionista — não são um diagnóstico."}'::jsonb,
 NULL,
 '["Fadiga persistente","Fome muito elevada","Perda de apetite","Irritabilidade ou alteração de humor","Dificuldade para manter o ritmo dos treinos","Queda de força","Piora do sono","Sensação frequente de frio","Diminuição da libido","Perda de peso não planejada","Lesões frequentes","Doenças frequentes","Preocupação excessiva com peso ou alimentos","Restrição voluntária de carboidratos","Nenhum desses sinais"]'::jsonb),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'ciclo_menstrual', '4. Saúde, sintomas e recuperação',
 'Ciclo menstrual', 'field_group', false, 22,
 '{"fields":[{"key":"situacao","label":"Como está seu ciclo menstrual atualmente?","type":"select","options":["Regular, sem alterações","Irregular","Fiquei três meses ou mais sem menstruar","A menstruação parou após aumento dos treinos ou perda de peso","Tenho fluxo menstrual muito intenso","Utilizo anticoncepcional hormonal e não consigo avaliar","Estou na menopausa","Não se aplica","Prefiro não responder"]},{"key":"ultima_menstruacao","label":"Quando ocorreu sua última menstruação espontânea? (mês/ano ou data)","type":"text","show_if":{"key":"self.situacao","op":"in","value":["Irregular","Fiquei três meses ou mais sem menstruar","A menstruação parou após aumento dos treinos ou perda de peso"]}}]}'::jsonb,
 '{"show_if":{"key":"sexo","op":"in","value":["Feminino","Intersexo"]}}'::jsonb,
 NULL),

('cdb87aff-804f-4c5f-9b90-61923317531a', 'sono', '4. Saúde, sintomas e recuperação',
 'Sono', 'field_group', false, 23,
 '{"fields":[{"key":"horas","label":"Horas de sono por noite","type":"select","options":["Menos de 5 horas","Entre 5 e 6 horas","Entre 6 e 7 horas","Entre 7 e 8 horas","Mais de 8 horas"]},{"key":"qualidade","label":"Qualidade do sono","type":"select","options":["Muito ruim","Ruim","Regular","Boa","Muito boa"]},{"key":"sinais","label":"Outros sinais","type":"multiselect","options":["Dificuldade para dormir","Acordo várias vezes","Acordo cansado","Sinto fome durante a noite","Tenho refluxo à noite","Nenhum"]}]}'::jsonb,
 NULL, NULL);
