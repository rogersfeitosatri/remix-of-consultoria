export interface MetabolicQuestion {
  id: string;
  text: string;
}

export interface MetabolicCategory {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  questions: MetabolicQuestion[];
}

export const metabolicCategories: MetabolicCategory[] = [
  {
    key: 'assimilacao',
    label: 'Assimilação',
    shortLabel: 'Assim.',
    color: 'hsl(210, 70%, 50%)',
    questions: [
      { id: 'a1', text: 'Azia ou refluxo ácido' },
      { id: 'a2', text: 'Sensação de estômago cheio ou lento após as refeições' },
      { id: 'a3', text: 'Gases ou flatulência excessivos' },
      { id: 'a4', text: 'Inchaço ou distensão abdominal' },
      { id: 'a5', text: 'Constipação ou diarreia frequente' },
      { id: 'a6', text: 'Fezes com odor forte ou aparência anormal' },
      { id: 'a7', text: 'Intolerância a alimentos específicos (lactose, glúten, etc.)' },
      { id: 'a8', text: 'Náuseas ou vômitos após comer' },
      { id: 'a9', text: 'Prisão de ventre crônica' },
      { id: 'a10', text: 'Cansaço logo após as refeições' },
    ],
  },
  {
    key: 'defesa_reparo',
    label: 'Defesa e Reparo',
    shortLabel: 'Def./Rep.',
    color: 'hsl(0, 70%, 50%)',
    questions: [
      { id: 'dr1', text: 'Rinites, sinusites ou alergias respiratórias recorrentes' },
      { id: 'dr2', text: 'Infecções frequentes (gripe, resfriado, candidíase)' },
      { id: 'dr3', text: 'Alergias alimentares ou de pele' },
      { id: 'dr4', text: 'Processos inflamatórios crônicos (tendinites, artrites)' },
      { id: 'dr5', text: 'Cicatrização lenta de feridas ou hematomas' },
      { id: 'dr6', text: 'Dores musculares ou articulares após exercício prolongado' },
      { id: 'dr7', text: 'Sensação de mal-estar geral ou febre baixa recorrente' },
      { id: 'dr8', text: 'Urticária ou erupções cutâneas recorrentes' },
      { id: 'dr9', text: 'Inflamação crônica com dor persistente' },
      { id: 'dr10', text: 'Histórico de doenças autoimunes' },
    ],
  },
  {
    key: 'energia',
    label: 'Energia',
    shortLabel: 'Energia',
    color: 'hsl(45, 80%, 50%)',
    questions: [
      { id: 'e1', text: 'Fadiga ou cansaço persistente mesmo após descanso' },
      { id: 'e2', text: 'Dificuldade para acordar ou necessidade de sonecas diárias' },
      { id: 'e3', text: 'Necessidade frequente de café, chá ou estimulantes' },
      { id: 'e4', text: 'Queda de rendimento físico ou mental ao longo do dia' },
      { id: 'e5', text: 'Dores musculares sem motivo aparente' },
      { id: 'e6', text: 'Dores de cabeça frequentes' },
      { id: 'e7', text: 'Sensação de fraqueza ao subir escadas ou carregar pesos' },
      { id: 'e8', text: 'Dificuldade de concentração ou lapsos de memória' },
      { id: 'e9', text: 'Sensação de "névoa mental"' },
      { id: 'e10', text: 'Variações bruscas de energia e humor durante o dia' },
    ],
  },
  {
    key: 'biotransformacao',
    label: 'Biotransformação e Eliminação',
    shortLabel: 'Biotransf.',
    color: 'hsl(120, 60%, 40%)',
    questions: [
      { id: 'b1', text: 'Sensibilidade a cheiros fortes (perfumes, produtos de limpeza)' },
      { id: 'b2', text: 'Dor de cabeça após exposição a fumaça, tintas ou solventes' },
      { id: 'b3', text: 'Intolerância ou reações adversas a medicamentos ou álcool' },
      { id: 'b4', text: 'Náuseas ou tonturas em ambientes com produtos químicos' },
      { id: 'b5', text: 'Inchaço abdominal ou pele opaca após ingestão de bebidas alcoólicas' },
      { id: 'b6', text: 'Constipação persistente mesmo com dieta rica em fibras' },
      { id: 'b7', text: 'Retenção de líquidos sem causa aparente' },
      { id: 'b8', text: 'Inchaço sob os olhos ou olheiras profundas' },
      { id: 'b9', text: 'Sudorese com odor forte' },
      { id: 'b10', text: 'Mau hálito persistente' },
    ],
  },
  {
    key: 'transporte',
    label: 'Transporte',
    shortLabel: 'Transp.',
    color: 'hsl(270, 60%, 50%)',
    questions: [
      { id: 't1', text: 'Sensação de mãos ou pés frios com facilidade' },
      { id: 't2', text: 'Inchaço em pernas, tornozelos ou pés' },
      { id: 't3', text: 'Varizes ou veias aparentes em membros inferiores' },
      { id: 't4', text: 'Tontura ou desmaio ao levantar-se rapidamente' },
      { id: 't5', text: 'Palpitações ou batimentos cardíacos irregulares' },
      { id: 't6', text: 'Falta de ar ao subir escadas leves' },
      { id: 't7', text: 'Pressão arterial alta ou baixa' },
      { id: 't8', text: 'Sensação de dormência ou formigamento nos membros' },
      { id: 't9', text: 'Facilidade para hematomas (roxos)' },
      { id: 't10', text: 'Lábios, orelhas ou extremidades arroxeadas ou pálidas' },
    ],
  },
  {
    key: 'comunicacao',
    label: 'Comunicação',
    shortLabel: 'Comun.',
    color: 'hsl(330, 60%, 50%)',
    questions: [
      { id: 'c1', text: 'Alterações de humor frequentes (irritabilidade, euforia, tristeza)' },
      { id: 'c2', text: 'Ansiedade ou nervosismo exagerados' },
      { id: 'c3', text: 'Dificuldade de concentração ou déficit de atenção' },
      { id: 'c4', text: 'Insônia ou sono de má qualidade' },
      { id: 'c5', text: 'Diminuição ou aumento da libido' },
      { id: 'c6', text: 'Irregularidade menstrual, TPM intensa ou cólicas fortes' },
      { id: 'c7', text: 'Queda de cabelo ou unhas fracas' },
      { id: 'c8', text: 'Sensação de "coração acelerado" sem motivo' },
      { id: 'c9', text: 'Suor excessivo ou ondas de calor' },
      { id: 'c10', text: 'Dores de cabeça relacionadas ao ciclo menstrual' },
    ],
  },
  {
    key: 'integridade_estrutural',
    label: 'Integridade Estrutural',
    shortLabel: 'Int. Est.',
    color: 'hsl(30, 70%, 50%)',
    questions: [
      { id: 'ie1', text: 'Dores articulares crônicas (joelho, ombro, punho)' },
      { id: 'ie2', text: 'Dor nas costas ou coluna vertebral' },
      { id: 'ie3', text: 'Fragilidade óssea (histórico de fraturas ou osteopenia)' },
      { id: 'ie4', text: 'Cãibras musculares frequentes' },
      { id: 'ie5', text: 'Postura inadequada ou desalinhamento corporal' },
      { id: 'ie6', text: 'Sensação de músculos fracos ou fraqueza muscular' },
      { id: 'ie7', text: 'Dificuldade em levantar objetos pesados' },
      { id: 'ie8', text: 'Unhas quebradiças ou pele ressecada' },
      { id: 'ie9', text: 'Dor ou rigidez ao acordar' },
      { id: 'ie10', text: 'Range os dentes (bruxismo) ou sente tensão na mandíbula' },
    ],
  },
  {
    key: 'mental_emocional',
    label: 'Dimensão Mental/Emocional/Espiritual',
    shortLabel: 'Mental',
    color: 'hsl(180, 50%, 45%)',
    questions: [
      { id: 'me1', text: 'Níveis de estresse no dia a dia' },
      { id: 'me2', text: 'Sensação de ansiedade ou preocupação constante' },
      { id: 'me3', text: 'Dificuldade para relaxar ou meditar' },
      { id: 'me4', text: 'Sensação de falta de propósito ou motivação' },
      { id: 'me5', text: 'Problemas de memória ou foco' },
      { id: 'me6', text: 'Oscilações de humor durante o dia' },
      { id: 'me7', text: 'Sensação de solidão ou isolamento' },
      { id: 'me8', text: 'Sentimentos de culpa ou autoestima baixa' },
      { id: 'me9', text: 'Falta de prazer em atividades que antes eram satisfatórias' },
      { id: 'me10', text: 'Prática espiritual ou religiosa insatisfatória para seus valores' },
    ],
  },
];

export const scoreLabels = [
  { value: 0, label: 'Nunca/Quase nunca' },
  { value: 1, label: 'Ocasional, não severo' },
  { value: 2, label: 'Ocasional, severo' },
  { value: 3, label: 'Frequente, não severo' },
  { value: 4, label: 'Frequente, severo' },
];

export function getInterpretation(totalScore: number): { label: string; color: string; description: string } {
  if (totalScore < 20) return { label: 'Equilíbrio funcional', color: 'hsl(120, 60%, 40%)', description: 'Menor chance de hipersensibilidades. Manter acompanhamento preventivo.' };
  if (totalScore <= 30) return { label: 'Atenção leve', color: 'hsl(45, 80%, 50%)', description: 'Alguns sinais de desequilíbrio. Avaliar áreas com maior pontuação.' };
  if (totalScore <= 40) return { label: 'Hipersensibilidades prováveis', color: 'hsl(30, 80%, 50%)', description: 'Forte suspeita de hipersensibilidades. Investigação mais aprofundada recomendada.' };
  if (totalScore <= 100) return { label: 'Desequilíbrio significativo', color: 'hsl(0, 70%, 50%)', description: 'Desequilíbrios funcionais significativos. Plano de intervenção individualizado necessário.' };
  return { label: 'Quadro preocupante', color: 'hsl(0, 80%, 40%)', description: 'Quadro preocupante com possível associação a doenças crônicas. Intervenção urgente.' };
}

export function getCategoryRecommendations(key: string, score: number): string[] {
  if (score < 10) return [];
  const recs: Record<string, string[]> = {
    assimilacao: [
      'Considerar enzimas digestivas (protease, lipase, amilase) antes das refeições principais',
      'Avaliar uso de probióticos de amplo espectro (Lactobacillus, Bifidobacterium)',
      'Glutamina (5-10g/dia) para suporte à barreira intestinal',
      'Aumentar alimentos fermentados: kefir, chucrute, kombucha',
      'Avaliar necessidade de teste de permeabilidade intestinal',
    ],
    defesa_reparo: [
      'Vitamina D3 (2000-4000 UI/dia) com monitoramento sérico',
      'Zinco (15-30mg/dia) para suporte imunológico',
      'Ômega-3 (EPA+DHA 2-3g/dia) como anti-inflamatório',
      'Cúrcuma/curcumina com piperina para modulação inflamatória',
      'Avaliar eliminação de alimentos pró-inflamatórios (glúten, laticínios A1)',
    ],
    energia: [
      'CoQ10 (100-200mg/dia) para suporte mitocondrial',
      'Magnésio quelado (200-400mg/dia) - glicinato ou malato',
      'Complexo B metilado (B12, folato ativo)',
      'Avaliar função tireoidiana (TSH, T3, T4 livre)',
      'Garantir ingestão adequada de ferro heme e avaliar ferritina sérica',
    ],
    biotransformacao: [
      'N-acetilcisteína (NAC) 600mg-1200mg/dia para suporte hepático',
      'Crucíferas (brócolis, couve) para indução de enzimas de fase II',
      'Silimarina (cardo mariano) 200-400mg/dia',
      'Aumentar ingestão de fibras solúveis para eliminação de toxinas',
      'Avaliar carga tóxica ambiental e reduzir exposição a xenobióticos',
    ],
    transporte: [
      'Vitamina C (500-1000mg/dia) para integridade vascular',
      'Ferro em forma quelada se ferritina < 30 ng/mL',
      'Vitamina B12 e folato para produção de hemácias',
      'Flavonoides (hesperidina, rutina) para saúde vascular',
      'Avaliar perfil lipídico completo e homocisteína',
    ],
    comunicacao: [
      'Magnésio glicinato (200-400mg/dia) para equilíbrio neuronal',
      'Vitamina B6 (P5P) 25-50mg/dia para síntese de neurotransmissores',
      'Triptofano ou 5-HTP para suporte serotoninérgico',
      'Avaliar painel hormonal completo (cortisol, tireoide, esteroides)',
      'Ashwagandha ou Rhodiola para modulação do eixo HPA',
    ],
    integridade_estrutural: [
      'Vitamina D3 + K2 para metabolismo ósseo',
      'Colágeno hidrolisado (10g/dia) para articulações e tendões',
      'Magnésio (300-400mg/dia) para prevenção de cãibras',
      'Cálcio de fontes biodisponíveis se ingestão dietética insuficiente',
      'Avaliar densitometria óssea e marcadores de turnover ósseo',
    ],
    mental_emocional: [
      'Ômega-3 (EPA predominante) para suporte ao humor',
      'Ashwagandha (300-600mg/dia) como adaptógeno',
      'Práticas de mindfulness, meditação ou yoga',
      'L-teanina (200mg/dia) para relaxamento sem sedação',
      'Avaliar cortisol salivar (ritmo circadiano) e DHEA',
    ],
  };
  return recs[key] || [];
}
