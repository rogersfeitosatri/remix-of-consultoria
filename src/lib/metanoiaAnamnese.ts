/**
 * O formulário único do Metanóia: a Anamnese Completa mais os blocos que
 * faltavam para montar o plano no app (nível de atividade diária, meta de
 * peso e composição, WhatsApp) e a seção comportamental do programa.
 *
 * Fica no domínio para a migração, o pacote para o app e os testes lerem a
 * mesma lista. As chaves comportamentais são as mesmas da avaliação curta
 * "Comer com Consciência", para as reavaliações compararem com esta.
 */
import {
  ANAMNESE_COMPLETA_QUESTIONS,
  type AnamneseCompletaQuestion,
} from './anamneseCompletaQuestions';
import { METANOIA_FORM_TITLE } from './metanoia';

export { METANOIA_FORM_TITLE };

export const METANOIA_FORM_DESCRIPTION =
  'Esta é a sua avaliação inicial do Metanóia. Ela leva cerca de 15 minutos e junta duas partes: ' +
  'o que precisamos para montar o seu plano alimentar e como está, hoje, a sua relação com a comida. ' +
  'Responda com calma e sem se julgar. Não existe resposta certa, existe a sua.';

const SECAO_COMPORTAMENTAL = '7. Comportamento alimentar';
const SECAO_OBSERVACOES = '8. Observações';

/** Opções alinhadas ao vocabulário do app (dailyActivityLevel). */
export const OPCOES_ATIVIDADE_DIARIA = [
  'Sentado a maior parte do dia',
  'Sentado, com deslocamentos',
  'Em pé ou caminhando boa parte do dia',
  'Trabalho físico',
] as const;

export const OPCOES_META_DE_PESO = [
  'Perder gordura',
  'Manter o peso',
  'Ganhar massa muscular',
  'Não tenho meta de peso',
] as const;

/** Blocos novos, inseridos depois de uma chave existente do template. */
const BLOCOS_NOVOS: Array<{ depois: string; pergunta: AnamneseCompletaQuestion }> = [
  {
    depois: 'data_nascimento',
    pergunta: {
      question_key: 'whatsapp',
      section: '1. Identificação e objetivos',
      question_text: 'WhatsApp (DDD + número)',
      question_type: 'text',
      is_required: true,
      helper: 'É por ele que você recebe o link de agendamento e o acompanhamento semanal.',
      config: { prefill_from_profile: 'phone', input: 'phone' },
    },
  },
  {
    depois: 'peso_altura',
    pergunta: {
      question_key: 'nivel_atividade_diaria',
      section: '1. Identificação e objetivos',
      question_text: 'Como é o seu dia fora do treino?',
      question_type: 'select',
      is_required: true,
      options: [...OPCOES_ATIVIDADE_DIARIA],
    },
  },
  {
    depois: 'objetivos',
    pergunta: {
      question_key: 'meta_peso_composicao',
      section: '1. Identificação e objetivos',
      question_text: 'Meta de peso ou composição corporal',
      question_type: 'field_group',
      config: {
        fields: [
          { key: 'meta', label: 'Qual é a sua meta?', type: 'select', options: [...OPCOES_META_DE_PESO], required: true },
          { key: 'peso_alvo_kg', label: 'Peso que gostaria de alcançar', type: 'number', unit: 'kg', min: 30, max: 250, step: 0.1,
            show_if: { key: 'self.meta', op: 'in', value: ['Perder gordura', 'Ganhar massa muscular'] } },
          { key: 'prazo', label: 'Em quanto tempo?', type: 'text', placeholder: 'Ex.: até a prova de novembro',
            show_if: { key: 'self.meta', op: 'not_equals', value: 'Não tenho meta de peso' } },
        ],
      },
    },
  },
];

const ABERTURA_COMPORTAMENTAL =
  'Agora, sobre a sua relação com a comida. Responda pensando nas últimas duas semanas. ' +
  'Não existe nota boa ou ruim: o objetivo é a gente comparar como você está hoje com como vai estar ao longo do programa.';

function nota(question_key: string, question_text: string): AnamneseCompletaQuestion {
  return {
    question_key,
    section: SECAO_COMPORTAMENTAL,
    question_text,
    question_type: 'scale',
    scale_min: 0,
    scale_max: 10,
    is_required: true,
  };
}

function aberta(question_key: string, question_text: string): AnamneseCompletaQuestion {
  return { question_key, section: SECAO_COMPORTAMENTAL, question_text, question_type: 'textarea', is_required: false };
}

/** A seção comportamental: 7 notas de 0 a 10 e 3 perguntas abertas, com as chaves da avaliação curta. */
export const PERGUNTAS_COMPORTAMENTAIS: AnamneseCompletaQuestion[] = [
  { question_key: 'aval_abertura', section: SECAO_COMPORTAMENTAL, question_text: ABERTURA_COMPORTAMENTAL, question_type: 'info' },
  nota('aval_entende_por_que_come', 'Quanto você entende hoje por que come do jeito que come?'),
  nota('aval_controle_escolhas', 'Quanto você sente que está no controle das suas escolhas com a comida?'),
  nota('aval_comida_na_cabeca', 'Quanto a comida ocupa a sua cabeça em um dia comum?'),
  nota('aval_culpa', 'Quanto de culpa você sente depois de comer algo fora do que planejou?'),
  nota('aval_autonomia', 'Quanto você confia que consegue manter o que conquistou sem depender de ninguém?'),
  nota('aval_comer_e_treino', 'Quanto o seu comer está te ajudando a treinar e a se recuperar bem?'),
  nota('aval_corpo_e_peso', 'Como está a sua relação com o seu corpo e com o seu peso?'),
  aberta('aval_relacao_em_uma_frase', 'Em uma frase, como você descreveria a sua relação com a comida hoje?'),
  aberta('aval_o_que_mudou', 'O que te trouxe ao Metanóia?'),
  aberta('aval_o_que_falta', 'O que você gostaria que fosse diferente ao final das 12 semanas?'),
];

export const CHAVES_COMPORTAMENTAIS_DE_NOTA = PERGUNTAS_COMPORTAMENTAIS
  .filter((q) => q.question_type === 'scale')
  .map((q) => q.question_key);

/**
 * A lista completa e ordenada do formulário: o template, com os blocos novos
 * no lugar certo, a seção comportamental e as observações por último.
 */
export function montarPerguntasMetanoia(
  base: AnamneseCompletaQuestion[] = ANAMNESE_COMPLETA_QUESTIONS,
): AnamneseCompletaQuestion[] {
  const semObservacoes = base.filter((q) => q.question_key !== 'observacoes_adicionais');
  const observacoes = base
    .filter((q) => q.question_key === 'observacoes_adicionais')
    .map((q) => ({ ...q, section: SECAO_OBSERVACOES }));

  const comNovos: AnamneseCompletaQuestion[] = [];
  for (const q of semObservacoes) {
    comNovos.push(q);
    for (const bloco of BLOCOS_NOVOS) {
      if (bloco.depois === q.question_key) comNovos.push(bloco.pergunta);
    }
  }
  const faltantes = BLOCOS_NOVOS.filter((b) => !comNovos.some((q) => q.question_key === b.pergunta.question_key));
  if (faltantes.length) {
    throw new Error(`Âncora ausente no template: ${faltantes.map((b) => b.depois).join(', ')}`);
  }
  return [...comNovos, ...PERGUNTAS_COMPORTAMENTAIS, ...observacoes];
}
