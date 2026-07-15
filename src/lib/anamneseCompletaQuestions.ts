// ANAMNESE COMPLETA — template das 29 perguntas principais (wizard).
// Estende o motor de anamnese dinâmica existente: cada item vira uma linha em
// anamnese_questions. Campos condicionais e sub-campos vivem em `config` para
// que o total de perguntas principais permaneça 29. A lógica condicional entre
// perguntas usa `conditional_logic` referenciando `question_key` (chave estável).
//
// Contrato de tipos (renderizados na Fase 2):
//  - text | textarea | number | date | time | boolean | select | multiselect | scale | chips
//  - field_group      → um conjunto fixo de sub-campos. answer = { [key]: valor }
//  - structured_list  → linhas repetíveis de sub-campos. answer = [{ ... }]
//  - meal_plan_editor → refeições estruturadas com alimentos (pergunta 24)
//  - symptom_grid     → por sintoma: momentos[]/frequência/intensidade (pergunta 15)
//  - frequency_grid   → linhas × coluna única (pergunta 28)
//  - file_upload      → anexos privados (pergunta 16) — storage na Fase 3
//  - training_week    → editor semanal (config.detailed adiciona duração/dist/RPE/tipo)
//
// Condição (conditional_logic.show_if e subfield.show_if):
//  { key, op, value } | { any: [...] } | { all: [...] }
//  op: 'equals' | 'not_equals' | 'in' | 'not_in' | 'includes' | 'includes_any'
//      | 'not_empty' | 'truthy'
//  Em sub-campos, prefixe a chave com 'self.' para referenciar outro sub-campo do
//  mesmo grupo (ex.: { key: 'self.situacao', op: 'in', value: [...] }).

export type AnamneseCompletaType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'boolean'
  | 'select' | 'multiselect' | 'scale' | 'chips'
  | 'field_group' | 'structured_list' | 'meal_plan_editor'
  | 'symptom_grid' | 'frequency_grid' | 'file_upload' | 'training_week';

export interface Condition {
  key?: string;
  op?: 'equals' | 'not_equals' | 'in' | 'not_in' | 'includes' | 'includes_any' | 'not_empty' | 'truthy';
  value?: any;
  any?: Condition[];
  all?: Condition[];
}

export interface SubField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'multiselect' | 'boolean' | 'chips' | 'structured_list' | 'file_upload' | 'select_from';
  options?: string[];
  unit?: string;
  placeholder?: string;
  required?: boolean;
  show_if?: Condition;         // referência a 'self.<key>' ou a outra pergunta
  from?: string;               // para select_from: chave cujas opções selecionadas viram as opções
  fields?: SubField[];         // para structured_list aninhada
  addLabel?: string;
}

export interface AnamneseCompletaQuestion {
  question_key: string;
  section: string;             // etapa do wizard
  question_text: string;
  question_type: AnamneseCompletaType;
  helper?: string;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  is_required?: boolean;
  has_comment_field?: boolean;
  comment_field_label?: string;
  config?: Record<string, any>;
  conditional_logic?: { show_if: Condition };
}

export const ANAMNESE_COMPLETA_TITLE = 'ANAMNESE COMPLETA';
export const ANAMNESE_COMPLETA_DESCRIPTION =
  'Responda com atenção. As informações serão utilizadas para criar um plano alimentar compatível com sua rotina, seus treinos, seus objetivos, suas preferências e os alimentos que você já consome.';

// Etapas do wizard (rótulos de seção)
const E1 = '1. Identificação e objetivos';
const E2 = '2. Treinamento e prova-alvo';
const E3 = '3. Alimentação relacionada ao treino';
const E4 = '4. Saúde, sintomas e recuperação';
const E5 = '5. Preferências e restrições';
const E6 = '6. Alimentação habitual';
const E7 = '7. Observações';

// Reutilizáveis
export const MEDIDAS_CASEIRAS = [
  'Gramas', 'Mililitros', 'Unidade', 'Fatia', 'Colher de chá', 'Colher de sopa',
  'Colher de servir', 'Concha', 'Xícara', 'Copo', 'Pegador', 'Porção', 'Outra',
];
const TRAINING_RELATION = ['Antes do treino', 'Depois do treino', 'Sem relação com o treino', 'Varia conforme o dia'];
const SESSION_MODALITIES = ['Corrida', 'Musculação', 'Ciclismo', 'Natação', 'Mobilidade', 'Outra'];
const SESSION_TYPES = [
  'Descanso', 'Regenerativo', 'Corrida leve', 'Corrida longa', 'Intervalado', 'Ritmo ou tempo run',
  'Limiar', 'Subidas', 'Treino progressivo', 'Musculação', 'Técnica', 'Transição', 'Competição', 'Outro',
];
const GI_SYMPTOMS = [
  'Distensão abdominal', 'Excesso de gases', 'Refluxo ou azia', 'Náusea', 'Dor abdominal', 'Diarreia',
  'Constipação', 'Urgência para evacuar', 'Sensação de digestão lenta', 'Arroto ou regurgitação',
];

export const ANAMNESE_COMPLETA_QUESTIONS: AnamneseCompletaQuestion[] = [
  // ─────────── Etapa 1 — Identificação e objetivos ───────────
  {
    question_key: 'nome_completo', section: E1, question_text: 'Nome completo',
    question_type: 'text', is_required: true,
    config: { prefill_from_profile: 'full_name' },
  },
  {
    question_key: 'data_nascimento', section: E1, question_text: 'Data de nascimento',
    question_type: 'date', is_required: true,
    config: { prefill_from_profile: 'birth_date' },
  },
  {
    question_key: 'sexo', section: E1,
    question_text: 'Sexo para fins de avaliação nutricional e hormonal',
    question_type: 'select', is_required: true,
    options: ['Masculino', 'Feminino', 'Intersexo', 'Prefiro não informar'],
    config: { prefill_from_profile: 'gender' },
  },
  {
    question_key: 'peso_altura', section: E1, question_text: 'Peso e altura atuais',
    question_type: 'field_group', is_required: true,
    config: {
      fields: [
        { key: 'peso_kg', label: 'Peso', type: 'number', unit: 'kg', required: true, min: 20, max: 300, step: 0.1, warn_below: 35, warn_above: 200, prefill_from_profile: 'current_weight' },
        { key: 'altura_cm', label: 'Altura', type: 'number', unit: 'cm', required: true, min: 120, max: 230, warn_below: 130, warn_above: 220, prefill_from_profile: 'height' },
      ],
    },
  },
  {
    question_key: 'mudanca_peso', section: E1, question_text: 'Mudança de peso nos últimos três meses',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'mudanca', label: 'O que ocorreu?', type: 'select', required: true,
          options: [
            'Permaneceu praticamente estável', 'Diminuiu menos de 2 kg', 'Diminuiu entre 2 e 5 kg',
            'Diminuiu mais de 5 kg', 'Aumentou menos de 2 kg', 'Aumentou entre 2 e 5 kg',
            'Aumentou mais de 5 kg', 'Não sei informar',
          ],
        },
        {
          key: 'planejada', label: 'Essa mudança foi planejada?', type: 'select',
          options: ['Sim', 'Não', 'Parcialmente'],
          show_if: { key: 'self.mudanca', op: 'not_in', value: ['Permaneceu praticamente estável', 'Não sei informar'] },
        },
      ],
    },
  },
  {
    question_key: 'objetivos', section: E1, question_text: 'Objetivos atuais',
    question_type: 'field_group', is_required: true,
    config: {
      fields: [
        {
          key: 'selecionados', label: 'Selecione seus objetivos', type: 'multiselect', required: true,
          options: [
            'Melhorar minha performance', 'Preparar-me para uma prova', 'Perder gordura corporal',
            'Manter o peso', 'Ganhar massa muscular', 'Ganhar peso', 'Melhorar minha recuperação',
            'Recuperar-me de uma lesão', 'Melhorar minha saúde', 'Melhorar sintomas gastrointestinais', 'Outro',
          ],
        },
        { key: 'outro', label: 'Qual outro objetivo?', type: 'text', show_if: { key: 'self.selecionados', op: 'includes', value: 'Outro' } },
        { key: 'prioritario', label: 'Qual é o objetivo mais importante neste momento?', type: 'select_from', from: 'selecionados', required: true },
      ],
    },
  },

  // ─────────── Etapa 2 — Treinamento e prova-alvo ───────────
  {
    question_key: 'modalidade_experiencia', section: E2, question_text: 'Modalidade e experiência',
    question_type: 'field_group', is_required: true,
    config: {
      fields: [
        {
          key: 'modalidades', label: 'Modalidade(s)', type: 'multiselect', required: true,
          options: ['Corrida de rua', 'Trail running', 'Triatlo', 'Duatlo', 'Ciclismo', 'Natação', 'Outra modalidade de endurance'],
        },
        { key: 'outra_modalidade', label: 'Qual outra modalidade?', type: 'text', show_if: { key: 'self.modalidades', op: 'includes', value: 'Outra modalidade de endurance' } },
        {
          key: 'tempo_pratica', label: 'Tempo de prática', type: 'select', required: true,
          options: ['Menos de 6 meses', 'De 6 meses a 1 ano', 'De 1 a 3 anos', 'De 3 a 5 anos', 'Mais de 5 anos'],
        },
      ],
    },
  },
  {
    question_key: 'semana_treino', section: E2, question_text: 'Semana habitual de treinamento',
    question_type: 'training_week', is_required: true,
    helper: 'Monte sua semana de segunda a domingo. Você pode adicionar mais de uma sessão no mesmo dia.',
    config: {
      detailed: true,
      modalities: SESSION_MODALITIES,
      sessionTypes: SESSION_TYPES,
      // campos coletados por sessão (renderizados na Fase 2)
      sessionFields: ['start_time', 'modality', 'session_type', 'duration_minutes', 'distance_km', 'rpe', 'notes'],
      allowMultiplePerDay: true, allowDuplicate: true,
    },
  },
  {
    question_key: 'estabilidade_rotina', section: E2, question_text: 'Estabilidade da rotina de treinamento',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'estabilidade', label: 'Como é sua rotina?', type: 'select', required: true,
          options: [
            'Minha semana costuma ser quase sempre assim', 'Muda um pouco a cada semana',
            'Muda bastante conforme a planilha', 'Estou iniciando uma nova fase de treinamento',
            'Estou reduzindo a carga', 'Estou retornando de lesão ou pausa',
          ],
        },
        { key: 'mudanca_prevista', label: 'Existe alguma mudança importante prevista para as próximas quatro semanas?', type: 'textarea' },
      ],
    },
  },
  {
    question_key: 'prova_alvo', section: E2, question_text: 'Prova-alvo',
    question_type: 'field_group',
    config: {
      fields: [
        { key: 'possui', label: 'Você possui alguma prova-alvo?', type: 'select', required: true, options: ['Sim', 'Não'] },
        { key: 'modalidade', label: 'Modalidade', type: 'text', show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'nome', label: 'Nome da prova (opcional)', type: 'text', show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'distancia', label: 'Distância', type: 'text', show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'data', label: 'Data', type: 'date', show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        
        { key: 'duracao_estimada', label: 'Duração estimada', type: 'text', show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'prioridade', label: 'Prioridade da prova', type: 'select', options: ['A', 'B', 'C'], show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'ja_fez_carbloading', label: 'Já realizou carbloading antes?', type: 'select', options: ['Sim', 'Não', 'Não sei o que é'], show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'desconforto_gi', label: 'Teve desconforto gastrointestinal em provas anteriores?', type: 'select', options: ['Sim', 'Não'], show_if: { key: 'self.possui', op: 'equals', value: 'Sim' } },
        { key: 'desconforto_gi_desc', label: 'Descreva o desconforto', type: 'textarea', show_if: { key: 'self.desconforto_gi', op: 'equals', value: 'Sim' } },
      ],
    },
  },

  // ─────────── Etapa 3 — Alimentação relacionada ao treino ───────────
  {
    question_key: 'pre_treino_matinal', section: E3, question_text: 'Alimentação antes dos treinos matinais',
    question_type: 'field_group',
    helper: 'Registrado como lanche pré-treino — não como café da manhã. A primeira refeição completa após o treino pode ser o café da manhã pós-treino.',
    config: {
      fields: [
        {
          key: 'situacao', label: 'Quando você treina pela manhã, o que normalmente acontece antes do treino?', type: 'select', required: true,
          options: [
            'Não como nada', 'Faço um lanche pequeno', 'Faço uma refeição completa', 'Consumo apenas café',
            'Consumo apenas líquidos ou suplemento', 'Depende do tipo de treino', 'Não treino pela manhã',
          ],
        },
        { key: 'horario', label: 'Horário aproximado', type: 'time', show_if: { key: 'self.situacao', op: 'in', value: ['Faço um lanche pequeno', 'Faço uma refeição completa', 'Depende do tipo de treino'] } },
        { key: 'alimentos', label: 'Alimentos e bebidas', type: 'textarea', show_if: { key: 'self.situacao', op: 'in', value: ['Faço um lanche pequeno', 'Faço uma refeição completa', 'Depende do tipo de treino'] } },
        { key: 'quantidades', label: 'Quantidades ou medidas caseiras', type: 'text', show_if: { key: 'self.situacao', op: 'in', value: ['Faço um lanche pequeno', 'Faço uma refeição completa', 'Depende do tipo de treino'] } },
        
      ],
    },
  },
  {
    question_key: 'intervalo_refeicao_treino', section: E3, question_text: 'Tempo entre a última refeição e o treino',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'intervalo', label: 'Quanto tempo, normalmente?', type: 'select', required: true,
          options: [
            'Menos de 30 minutos', 'Entre 30 e 60 minutos', 'Entre 1 e 2 horas', 'Entre 2 e 3 horas',
            'Mais de 3 horas', 'Varia conforme o dia', 'Normalmente treino sem comer',
          ],
        },
        { key: 'quando_varia', label: 'Em quais treinos ou horários isso muda?', type: 'text', show_if: { key: 'self.intervalo', op: 'equals', value: 'Varia conforme o dia' } },
      ],
    },
  },
  {
    question_key: 'intra_treino', section: E3, question_text: 'Alimentação durante treinos mais longos',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'consumos', label: 'O que costuma consumir?', type: 'multiselect', required: true,
          options: [
            'Não consumo nada', 'Água', 'Bebida esportiva', 'Gel de carboidrato', 'Doce de leite', 'Rapadura',
            'Paçoca', 'Frutas', 'Frutas secas', 'Eletrólitos ou cápsula de sal', 'Outro',
            'Ainda não realizo treinos que necessitem alimentação',
          ],
        },
        {
          key: 'produtos', label: 'Produtos/alimentos utilizados', type: 'structured_list', addLabel: 'Adicionar produto',
          show_if: { key: 'self.consumos', op: 'includes_any', value: ['Bebida esportiva', 'Gel de carboidrato', 'Doce de leite', 'Rapadura', 'Paçoca', 'Frutas', 'Frutas secas', 'Eletrólitos ou cápsula de sal', 'Outro'] },
          fields: [
            { key: 'produto', label: 'Produto ou alimento', type: 'text', required: true },
            { key: 'marca', label: 'Marca (se aplicável)', type: 'text' },
            { key: 'quantidade_total', label: 'Quantidade total', type: 'text' },
            { key: 'frequencia_hora', label: 'Frequência por hora', type: 'text' },
            { key: 'liquidos_hora', label: 'Líquidos por hora', type: 'text' },
            { key: 'cafeina', label: 'Contém cafeína?', type: 'select', options: ['Sim', 'Não', 'Não sei'] },
          ],
        },
      ],
    },
  },
  {
    question_key: 'hidratacao', section: E3, question_text: 'Hidratação e transpiração',
    question_type: 'field_group',
    config: {
      fields: [
        { key: 'liquidos_dia', label: 'Quantidade média de líquidos por dia', type: 'select', required: true, options: ['Menos de 1 litro', 'Entre 1 e 2 litros', 'Entre 2 e 3 litros', 'Mais de 3 litros', 'Não sei informar'] },
        { key: 'transpiracao', label: 'Como considera sua transpiração', type: 'select', options: ['Baixa', 'Moderada', 'Alta', 'Muito alta', 'Não sei'] },
        {
          key: 'sinais', label: 'Sinais durante ou depois dos treinos', type: 'multiselect',
          options: ['Muita sede', 'Dor de cabeça', 'Tontura', 'Cãibras', 'Marcas brancas de sal na roupa ou pele', 'Urina muito escura', 'Nenhum desses sinais'],
        },
      ],
    },
  },

  // ─────────── Etapa 4 — Saúde, sintomas e recuperação ───────────
  {
    question_key: 'sintomas_gi', section: E4, question_text: 'Sintomas gastrointestinais',
    question_type: 'symptom_grid',
    helper: 'Para cada sintoma marcado, informe o momento (pode marcar mais de um), a frequência e a intensidade.',
    config: {
      symptoms: [...GI_SYMPTOMS, 'Nenhum'],
      noneOption: 'Nenhum',
      moments: ['Fora dos treinos', 'Antes do treino', 'Durante o treino', 'Depois do treino'],
      frequencies: ['Raramente', 'Às vezes', 'Frequentemente', 'Sempre'],
      intensities: ['Leve', 'Moderada', 'Forte'],
    },
  },
  {
    question_key: 'diagnosticos_exames', section: E4, question_text: 'Diagnósticos e exames',
    question_type: 'field_group',
    helper: 'Não interpretamos exames aqui; os arquivos são apenas armazenados com segurança para análise posterior.',
    config: {
      fields: [
        {
          key: 'diagnosticos', label: 'Você possui diagnóstico, acompanhamento médico ou exames recentes com alterações?', type: 'multiselect', required: true,
          options: [
            'Anemia ou deficiência de ferro', 'Diabetes ou alteração da glicemia', 'Hipertensão',
            'Alteração de colesterol ou triglicerídeos', 'Doença gastrointestinal', 'Doença da tireoide',
            'Doença renal', 'Doença hepática', 'Alergia alimentar diagnosticada',
            'Transtorno alimentar atual ou anterior', 'Outro diagnóstico', 'Não possuo', 'Não sei informar',
          ],
        },
        { key: 'descricao', label: 'Descrição curta', type: 'textarea', show_if: { key: 'self.diagnosticos', op: 'includes_any', value: ['Anemia ou deficiência de ferro', 'Diabetes ou alteração da glicemia', 'Hipertensão', 'Alteração de colesterol ou triglicerídeos', 'Doença gastrointestinal', 'Doença da tireoide', 'Doença renal', 'Doença hepática', 'Alergia alimentar diagnosticada', 'Transtorno alimentar atual ou anterior', 'Outro diagnóstico'] } },
        { key: 'data_diagnostico', label: 'Data aproximada do diagnóstico', type: 'date', show_if: { key: 'self.diagnosticos', op: 'includes_any', value: ['Anemia ou deficiência de ferro', 'Diabetes ou alteração da glicemia', 'Hipertensão', 'Alteração de colesterol ou triglicerídeos', 'Doença gastrointestinal', 'Doença da tireoide', 'Doença renal', 'Doença hepática', 'Alergia alimentar diagnosticada', 'Transtorno alimentar atual ou anterior', 'Outro diagnóstico'] } },
        { key: 'data_exames', label: 'Data dos exames mais recentes', type: 'date', show_if: { key: 'self.diagnosticos', op: 'includes_any', value: ['Anemia ou deficiência de ferro', 'Diabetes ou alteração da glicemia', 'Hipertensão', 'Alteração de colesterol ou triglicerídeos', 'Doença gastrointestinal', 'Doença da tireoide', 'Doença renal', 'Doença hepática', 'Alergia alimentar diagnosticada', 'Transtorno alimentar atual ou anterior', 'Outro diagnóstico'] } },
        { key: 'anexos', label: 'Anexar exames (opcional)', type: 'file_upload' },
      ],
    },
  },
  {
    question_key: 'medicamentos', section: E4, question_text: 'Medicamentos',
    question_type: 'field_group',
    config: {
      fields: [
        { key: 'usa', label: 'Você utiliza algum medicamento de forma contínua?', type: 'select', required: true, options: ['Sim', 'Não'] },
        {
          key: 'lista', label: 'Medicamentos', type: 'structured_list', addLabel: 'Adicionar medicamento',
          show_if: { key: 'self.usa', op: 'equals', value: 'Sim' },
          fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'dose', label: 'Dose (se souber)', type: 'text' },
            { key: 'horario', label: 'Horário', type: 'text' },
            { key: 'motivo', label: 'Motivo de uso', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    question_key: 'saude_recuperacao', section: E4, question_text: 'Saúde e recuperação',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'situacoes', label: 'Como está sua saúde e recuperação?', type: 'multiselect', required: true,
          options: [
            'Estou lesionado', 'Tenho uma dor persistente', 'Já tive fratura por estresse', 'Tenho lesões recorrentes',
            'Minha recuperação está mais lenta', 'Tenho dor muscular por vários dias', 'Fico doente com frequência',
            'Meu desempenho caiu recentemente', 'Estou me recuperando normalmente', 'Nenhuma das opções',
          ],
        },
        { key: 'descricao', label: 'Qual é a lesão, dor ou problema?', type: 'textarea', show_if: { key: 'self.situacoes', op: 'includes_any', value: ['Estou lesionado', 'Tenho uma dor persistente', 'Já tive fratura por estresse', 'Tenho lesões recorrentes', 'Minha recuperação está mais lenta', 'Tenho dor muscular por vários dias', 'Fico doente com frequência', 'Meu desempenho caiu recentemente'] } },
        { key: 'ha_quanto_tempo', label: 'Há quanto tempo?', type: 'text', show_if: { key: 'self.situacoes', op: 'includes_any', value: ['Estou lesionado', 'Tenho uma dor persistente', 'Já tive fratura por estresse', 'Tenho lesões recorrentes', 'Minha recuperação está mais lenta', 'Tenho dor muscular por vários dias', 'Fico doente com frequência', 'Meu desempenho caiu recentemente'] } },
        { key: 'acompanhamento', label: 'Está em acompanhamento profissional?', type: 'select', options: ['Sim', 'Não'], show_if: { key: 'self.situacoes', op: 'includes_any', value: ['Estou lesionado', 'Tenho uma dor persistente', 'Já tive fratura por estresse', 'Tenho lesões recorrentes', 'Minha recuperação está mais lenta', 'Tenho dor muscular por vários dias', 'Fico doente com frequência', 'Meu desempenho caiu recentemente'] } },
      ],
    },
  },
  {
    question_key: 'sinais_tres_meses', section: E4, question_text: 'Sinais percebidos nos últimos três meses',
    question_type: 'multiselect',
    helper: 'Suas respostas geram apenas alertas internos ao nutricionista — não são um diagnóstico.',
    options: [
      'Fadiga persistente', 'Fome muito elevada', 'Perda de apetite', 'Irritabilidade ou alteração de humor',
      'Dificuldade para manter o ritmo dos treinos', 'Queda de força', 'Piora do sono',
      'Sensação frequente de frio', 'Diminuição da libido', 'Perda de peso não planejada',
      'Lesões frequentes', 'Doenças frequentes', 'Preocupação excessiva com peso ou alimentos',
      'Restrição voluntária de carboidratos', 'Nenhum desses sinais',
    ],
  },
  {
    question_key: 'ciclo_menstrual', section: E4, question_text: 'Ciclo menstrual',
    question_type: 'field_group',
    conditional_logic: { show_if: { key: 'sexo', op: 'in', value: ['Feminino', 'Intersexo'] } },
    config: {
      fields: [
        {
          key: 'situacao', label: 'Como está seu ciclo menstrual atualmente?', type: 'select',
          options: [
            'Regular, sem alterações', 'Irregular', 'Fiquei três meses ou mais sem menstruar',
            'A menstruação parou após aumento dos treinos ou perda de peso', 'Tenho fluxo menstrual muito intenso',
            'Utilizo anticoncepcional hormonal e não consigo avaliar', 'Estou na menopausa', 'Não se aplica', 'Prefiro não responder',
          ],
        },
        { key: 'ultima_menstruacao', label: 'Quando ocorreu sua última menstruação espontânea? (mês/ano ou data)', type: 'text', show_if: { key: 'self.situacao', op: 'in', value: ['Irregular', 'Fiquei três meses ou mais sem menstruar', 'A menstruação parou após aumento dos treinos ou perda de peso'] } },
      ],
    },
  },
  {
    question_key: 'sono', section: E4, question_text: 'Sono',
    question_type: 'field_group',
    config: {
      fields: [
        { key: 'horas', label: 'Horas de sono por noite', type: 'select', options: ['Menos de 5 horas', 'Entre 5 e 6 horas', 'Entre 6 e 7 horas', 'Entre 7 e 8 horas', 'Mais de 8 horas'] },
        { key: 'qualidade', label: 'Qualidade do sono', type: 'select', options: ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Muito boa'] },
        { key: 'sinais', label: 'Outros sinais', type: 'multiselect', options: ['Dificuldade para dormir', 'Acordo várias vezes', 'Acordo cansado', 'Sinto fome durante a noite', 'Tenho refluxo à noite', 'Nenhum'] },
      ],
    },
  },

  // ─────────── Etapa 5 — Preferências e restrições ───────────
  {
    question_key: 'restricoes', section: E5, question_text: 'Restrições alimentares',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'tipos', label: 'Você possui alguma restrição?', type: 'multiselect', required: true,
          options: [
            'Alergia alimentar diagnosticada', 'Intolerância à lactose', 'Doença celíaca', 'Vegetarianismo',
            'Veganismo', 'Restrição religiosa', 'Retirei um alimento por desconforto',
            'Retirei um alimento por preferência', 'Nenhuma', 'Outra',
          ],
        },
        { key: 'alimento_grupo', label: 'Qual alimento ou grupo alimentar?', type: 'text', show_if: { key: 'self.tipos', op: 'includes_any', value: ['Alergia alimentar diagnosticada', 'Intolerância à lactose', 'Doença celíaca', 'Vegetarianismo', 'Veganismo', 'Restrição religiosa', 'Retirei um alimento por desconforto', 'Retirei um alimento por preferência', 'Outra'] } },
        { key: 'reacao_motivo', label: 'Qual reação ou motivo?', type: 'text', show_if: { key: 'self.tipos', op: 'includes_any', value: ['Alergia alimentar diagnosticada', 'Intolerância à lactose', 'Doença celíaca', 'Vegetarianismo', 'Veganismo', 'Restrição religiosa', 'Retirei um alimento por desconforto', 'Retirei um alimento por preferência', 'Outra'] } },
        { key: 'diagnostico_profissional', label: 'Existe diagnóstico profissional?', type: 'select', options: ['Sim', 'Não', 'Não se aplica'], show_if: { key: 'self.tipos', op: 'includes_any', value: ['Alergia alimentar diagnosticada', 'Intolerância à lactose', 'Doença celíaca', 'Vegetarianismo', 'Veganismo', 'Restrição religiosa', 'Retirei um alimento por desconforto', 'Retirei um alimento por preferência', 'Outra'] } },
      ],
    },
  },
  {
    question_key: 'preferencias', section: E5, question_text: 'Preferências e alimentos que devem ser evitados',
    question_type: 'field_group',
    config: {
      fields: [
        { key: 'gosta', label: 'Alimentos de que gosta e gostaria de manter no plano', type: 'chips' },
        { key: 'evitar', label: 'Alimentos de que não gosta, não tolera ou não deseja receber no plano', type: 'chips' },
      ],
    },
  },
  {
    question_key: 'fome_comportamento', section: E5, question_text: 'Fome e comportamento alimentar',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'padroes', label: 'Como está sua fome e seu comportamento alimentar?', type: 'multiselect', required: true,
          options: [
            'Sinto pouca fome', 'Minha fome é adequada', 'Sinto muita fome entre as refeições', 'Sinto muita fome à noite',
            'Tenho vontade frequente de doces', 'Belisco sem perceber', 'Como além da saciedade',
            'Pulo refeições por falta de tempo', 'Evito comer para controlar o peso',
            'Tenho episódios de perda de controle', 'Nenhuma dificuldade relevante',
          ],
        },
        { key: 'quando', label: 'Em qual horário ou situação isso ocorre com mais frequência?', type: 'text', show_if: { key: 'self.padroes', op: 'includes_any', value: ['Sinto pouca fome', 'Sinto muita fome entre as refeições', 'Sinto muita fome à noite', 'Tenho vontade frequente de doces', 'Belisco sem perceber', 'Como além da saciedade', 'Pulo refeições por falta de tempo', 'Evito comer para controlar o peso', 'Tenho episódios de perda de controle'] } },
      ],
    },
  },

  // ─────────── Etapa 6 — Alimentação habitual ───────────
  {
    question_key: 'alimentacao_habitual', section: E6, question_text: 'Alimentação em um dia habitual',
    question_type: 'meal_plan_editor', is_required: true,
    helper: 'Ex.: “7h30, depois do treino: 2 pães franceses, 3 ovos mexidos, 1 banana e 1 xícara de café com açúcar.” Esta é a referência principal para montar a Opção 1 de cada refeição.',
    config: {
      units: MEDIDAS_CASEIRAS,
      trainingRelations: TRAINING_RELATION,
      defaultMeals: [
        'Lanche pré-treino', 'Café da manhã ou café da manhã pós-treino', 'Lanche da manhã', 'Almoço',
        'Lanche da tarde', 'Lanche pré-treino da tarde ou noite', 'Jantar ou refeição pós-treino', 'Ceia',
        'Beliscos ou alimentos fora das refeições',
      ],
      mealFields: ['meal_name', 'time', 'days_per_week', 'training_relation'],
      foodFields: ['food_name', 'quantity', 'unit', 'preparation', 'brand'],
    },
  },
  {
    question_key: 'diferencas_entre_dias', section: E6, question_text: 'Diferenças entre os dias',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'mudancas', label: 'Sua alimentação muda conforme o tipo de treino ou o dia da semana?', type: 'multiselect', required: true,
          options: [
            'Como mais nos dias de longão', 'Como mais nos dias de treino intenso', 'Como menos nos dias de descanso',
            'Mudo apenas o pré-treino', 'Mudo apenas o pós-treino', 'Como diferente aos finais de semana',
            'Como diferente quando treino em outro horário', 'Minha alimentação é praticamente igual todos os dias', 'Não sei avaliar',
          ],
        },
        { key: 'o_que_muda', label: 'Informe apenas o que normalmente muda (alimento, quantidade, horário, dia/tipo de treino)', type: 'textarea', show_if: { key: 'self.mudancas', op: 'includes_any', value: ['Como mais nos dias de longão', 'Como mais nos dias de treino intenso', 'Como menos nos dias de descanso', 'Mudo apenas o pré-treino', 'Mudo apenas o pós-treino', 'Como diferente aos finais de semana', 'Como diferente quando treino em outro horário'] } },
      ],
    },
  },
  {
    question_key: 'suplementos', section: E6, question_text: 'Suplementos e produtos esportivos',
    question_type: 'field_group',
    config: {
      fields: [
        {
          key: 'itens', label: 'Quais utiliza?', type: 'multiselect', required: true,
          options: [
            'Whey protein ou outra proteína', 'Creatina', 'Cafeína', 'Gel de carboidrato', 'Bebida esportiva',
            'Eletrólitos ou cápsulas de sal', 'Multivitamínico', 'Ferro', 'Vitamina D', 'Vitamina B12',
            'Ômega-3', 'Probiótico', 'Fitoterápico', 'Outro', 'Não utilizo',
          ],
        },
        {
          key: 'detalhes', label: 'Detalhes por item', type: 'structured_list', addLabel: 'Adicionar suplemento',
          show_if: { key: 'self.itens', op: 'includes_any', value: ['Whey protein ou outra proteína', 'Creatina', 'Cafeína', 'Gel de carboidrato', 'Bebida esportiva', 'Eletrólitos ou cápsulas de sal', 'Multivitamínico', 'Ferro', 'Vitamina D', 'Vitamina B12', 'Ômega-3', 'Probiótico', 'Fitoterápico', 'Outro'] },
          fields: [
            { key: 'produto', label: 'Produto', type: 'text', required: true },
            { key: 'marca', label: 'Marca', type: 'text' },
            { key: 'quantidade', label: 'Quantidade', type: 'text' },
            { key: 'horario', label: 'Horário', type: 'text' },
            { key: 'frequencia', label: 'Frequência', type: 'text' },
            { key: 'quem_recomendou', label: 'Quem recomendou', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    question_key: 'frequencia_alimentar', section: E6, question_text: 'Frequência de consumo de grupos alimentares',
    question_type: 'frequency_grid',
    helper: 'Esta grade não substitui o registro alimentar acima — serve para avaliar variedade e criar alternativas.',
    config: {
      rows: [
        'Frutas', 'Verduras e legumes', 'Feijão, lentilha, ervilha ou grão-de-bico', 'Leite, iogurte ou queijo',
        'Bebida vegetal fortificada', 'Ovos', 'Carne bovina', 'Frango', 'Peixes ou sardinha',
        'Castanhas, amendoim ou pasta de amendoim', 'Chia, linhaça ou outras sementes', 'Aveia ou cereais integrais',
        'Produtos ultraprocessados', 'Bebidas alcoólicas',
      ],
      columns: [
        'Nunca', 'Menos de uma vez por semana', 'Uma a duas vezes por semana', 'Três a quatro vezes por semana',
        'Cinco a seis vezes por semana', 'Uma vez ao dia', 'Duas ou mais vezes ao dia',
      ],
    },
  },

  // ─────────── Etapa 7 — Observações ───────────
  {
    question_key: 'observacoes_adicionais', section: E7, question_text: 'Observações adicionais',
    question_type: 'textarea',
    helper: 'Utilize este espaço para informar algo sobre sua rotina, saúde, alimentação, treinos, prova-alvo ou preferências que considere importante para a criação do seu plano.',
  },
];

// Perguntas cujo preenchimento é essencial antes do envio (validação específica).
export const ANAMNESE_COMPLETA_REQUIRED_KEYS = ANAMNESE_COMPLETA_QUESTIONS
  .filter((q) => q.is_required)
  .map((q) => q.question_key);

// Tipos novos introduzidos por este template (para o builder reconhecer).
export const ANAMNESE_COMPLETA_NEW_TYPES: AnamneseCompletaType[] = [
  'time', 'chips', 'field_group', 'structured_list', 'meal_plan_editor',
  'symptom_grid', 'frequency_grid', 'file_upload',
];

export function isAnamneseCompletaForm(form: { title?: string | null } | null | undefined): boolean {
  return !!form?.title && /anamnese completa/i.test(form.title);
}
