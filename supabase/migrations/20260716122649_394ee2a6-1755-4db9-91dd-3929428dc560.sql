UPDATE public.anamnese_questions
SET config = jsonb_build_object(
  'fields', jsonb_build_array(
    jsonb_build_object(
      'key','situacao','label','Quando você treina pela manhã, o que normalmente acontece antes do treino?','type','select','required',true,
      'options', jsonb_build_array('Não como nada','Faço um lanche pequeno','Faço uma refeição completa','Consumo apenas café','Consumo apenas líquidos ou suplemento','Depende do tipo de treino','Não treino pela manhã')
    ),
    jsonb_build_object(
      'key','horario','label','Horário aproximado','type','time',
      'show_if', jsonb_build_object('key','self.situacao','op','in','value', jsonb_build_array('Faço um lanche pequeno','Faço uma refeição completa','Depende do tipo de treino'))
    ),
    jsonb_build_object(
      'key','alimentos_bebidas_quantidades','label','Alimentos, bebidas, quantidades e porções','type','textarea','placeholder','Ex.: 1 pão francês com queijo, 200 ml de café com leite, 1 banana...',
      'show_if', jsonb_build_object('key','self.situacao','op','in','value', jsonb_build_array('Faço um lanche pequeno','Faço uma refeição completa','Depende do tipo de treino'))
    )
  )
)
WHERE form_id='cdb87aff-804f-4c5f-9b90-61923317531a' AND question_key='pre_treino_matinal';