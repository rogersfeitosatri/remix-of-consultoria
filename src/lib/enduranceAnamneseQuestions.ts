// Definição das perguntas do modelo de anamnese para atletas de endurance,
// exibido em wizard de 1 pergunta por tela. As perguntas seguem a estrutura da
// anamnese nutricional existente, com as modificações solicitadas por seção.
//
// Cada item vira uma linha em `anamnese_questions`. O campo `section` é usado
// para agrupar visualmente; a ordem é dada por `order_index`.

export interface EnduranceQuestionDef {
  section: string;
  question_text: string;
  question_type: string;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  is_required?: boolean;
  has_comment_field?: boolean;
  comment_field_label?: string;
  comment_field_required?: boolean;
}

// Sintomas gastrointestinais avaliados por frequência (0 = nunca … 5 = muito frequente).
export const ENDURANCE_SYMPTOMS = [
  'Azia',
  'Vontade de ir ao banheiro',
  'Refluxo',
  'Dor abdominal',
  'Náusea',
  'Cólica',
  'Gases',
  'Inchaço abdominal',
] as const;

export const ENDURANCE_ANAMNESE_TITLE = 'Anamnese Endurance (wizard)';

// Detecta se um formulário deve ser exibido como wizard (1 pergunta por tela).
// Prioriza a coluna single_question_wizard quando existir; senão, usa o título
// (que contém "(wizard)") — assim funciona mesmo sem a migration aplicada.
export function isWizardAnamneseForm(form: { title?: string | null; single_question_wizard?: boolean | null } | null | undefined): boolean {
  if (!form) return false;
  if (form.single_question_wizard) return true;
  return /\(wizard\)/i.test(form.title || '');
}
export const ENDURANCE_ANAMNESE_DESCRIPTION =
  'Anamnese para atletas de endurance, exibida como wizard de 1 pergunta por tela. Inclui histórico de saúde (sim/não), sintomas gastrointestinais durante treinos longos, alimentação habitual por refeição e treinos por dia da semana.';

export const ENDURANCE_ANAMNESE_QUESTIONS: EnduranceQuestionDef[] = [
  // ─────────────── Dados Pessoais (1º bloco) ───────────────
  {
    section: 'Dados Pessoais',
    question_text: 'Nome completo',
    question_type: 'text',
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Data de nascimento',
    question_type: 'date',
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Sexo',
    question_type: 'select',
    options: ['Masculino', 'Feminino', 'Outro'],
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'E-mail',
    question_type: 'text',
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Telefone / WhatsApp',
    question_type: 'text',
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Cidade / Estado',
    question_type: 'text',
    is_required: false,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Profissão / ocupação',
    question_type: 'text',
    is_required: false,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Altura (cm)',
    question_type: 'number',
    is_required: true,
  },
  {
    section: 'Dados Pessoais',
    question_text: 'Peso atual (kg)',
    question_type: 'number',
    is_required: true,
  },

  // ─────────────── Histórico e Saúde ───────────────
  {
    section: 'Histórico e Saúde',
    question_text: 'Você tem ou já teve alguma doença diagnosticada?',
    question_type: 'boolean',
    is_required: true,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais?',
    comment_field_required: false,
  },
  {
    section: 'Histórico e Saúde',
    question_text: 'Faz uso contínuo de algum medicamento?',
    question_type: 'boolean',
    is_required: true,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais?',
    comment_field_required: false,
  },
  {
    section: 'Histórico e Saúde',
    question_text: 'Possui alguma alergia ou intolerância alimentar?',
    question_type: 'boolean',
    is_required: true,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais?',
    comment_field_required: false,
  },
  {
    section: 'Histórico e Saúde',
    question_text: 'Já passou por alguma cirurgia?',
    question_type: 'boolean',
    is_required: false,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais?',
    comment_field_required: false,
  },
  {
    section: 'Histórico e Saúde',
    question_text: 'Possui histórico de distúrbios gastrointestinais?',
    question_type: 'boolean',
    is_required: false,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais?',
    comment_field_required: false,
  },
  {
    section: 'Histórico e Saúde',
    question_text:
      'Descreva seu histórico de peso (variações ao longo do tempo, maior e menor peso, tentativas de mudança).',
    question_type: 'textarea',
    is_required: false,
  },

  // ─────────────── Objetivos ───────────────
  {
    section: 'Objetivos',
    question_text: 'Qual é o seu principal objetivo com o acompanhamento nutricional?',
    question_type: 'select',
    options: [
      'Melhorar a performance esportiva',
      'Emagrecimento / composição corporal',
      'Ganho de massa muscular',
      'Saúde e bem-estar',
      'Preparação para uma prova específica',
    ],
    is_required: true,
  },
  {
    section: 'Objetivos',
    question_text: 'Existe uma meta de peso ou composição corporal? Descreva.',
    question_type: 'textarea',
    is_required: false,
  },

  // ─────────────── Preferências ───────────────
  {
    section: 'Preferências',
    question_text: 'Quais alimentos você mais gosta de consumir?',
    question_type: 'textarea',
    is_required: false,
  },
  {
    section: 'Preferências',
    question_text: 'Quais alimentos você não gosta ou prefere evitar?',
    question_type: 'textarea',
    is_required: false,
  },
  {
    section: 'Preferências',
    question_text: 'Segue algum padrão alimentar específico (vegetariano, vegano, low carb, etc.)?',
    question_type: 'textarea',
    is_required: false,
  },

  // ─────────────── O que come habitualmente (meal_items: 1 tela por refeição) ───────────────
  {
    section: 'O que come habitualmente',
    question_text: 'Café da manhã',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text: 'Lanche da manhã',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text: 'Almoço',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text: 'Lanche da tarde',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text: 'Jantar',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text: 'Ceia',
    question_type: 'meal_items',
    is_required: false,
  },
  {
    section: 'O que come habitualmente',
    question_text:
      'Durante treinos longos, com que frequência você sente os sintomas abaixo? (0 = nunca, 5 = muito frequente)',
    question_type: 'symptom_scale',
    options: [...ENDURANCE_SYMPTOMS],
    scale_min: 0,
    scale_max: 5,
    is_required: false,
    has_comment_field: true,
    comment_field_label: 'Outros sintomas / observações',
    comment_field_required: false,
  },

  // ─────────────── Suplementação ───────────────
  {
    section: 'Suplementação',
    question_text: 'Você faz uso de algum suplemento?',
    question_type: 'boolean',
    is_required: true,
    has_comment_field: true,
    comment_field_label: 'Se sim, quais e como usa?',
    comment_field_required: false,
  },

  // ─────────────── Treinos e Competições (training_week: 1 tela por dia) ───────────────
  {
    section: 'Treinos e Competições',
    question_text: 'Frequência semanal de treinos',
    question_type: 'training_week',
    is_required: false,
  },
  {
    section: 'Treinos e Competições',
    question_text: 'Qual é o seu nível atual como atleta?',
    question_type: 'select',
    options: [
      'Iniciante',
      'Intermediário',
      'Avançado',
      'Elite / competitivo',
    ],
    is_required: true,
  },
  {
    section: 'Treinos e Competições',
    question_text:
      'Descreva suas provas-alvo (nome, distância/modalidade e data), em ordem de prioridade.',
    question_type: 'textarea',
    is_required: false,
  },

  // ─────────────── Final ───────────────
  {
    section: 'Final',
    question_text: 'Há algo mais que você gostaria de compartilhar?',
    question_type: 'textarea',
    is_required: false,
  },
];
