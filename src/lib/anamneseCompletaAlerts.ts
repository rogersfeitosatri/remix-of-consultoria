// Alertas internos ao nutricionista (NÃO são diagnóstico e não são exibidos ao
// atleta). Regras determinísticas a partir das respostas normalizadas por chave.
import { answersByKey } from './anamneseCompletaNormalize';

export type AlertLevel = 'info' | 'attention' | 'high';
export interface InternalAlert {
  category: string;
  level: AlertLevel;
  question_key: string;
  answer: string;      // resposta que gerou o alerta (resumida)
  message: string;
}

interface QLike { id: string; question_key?: string | null; }

const has = (arr: any, v: string) => Array.isArray(arr) && arr.includes(v);
const hasAny = (arr: any, vs: string[]) => Array.isArray(arr) && vs.some((v) => arr.includes(v));

export function computeInternalAlerts(
  questions: QLike[],
  responses: Record<string, any> | null | undefined,
): InternalAlert[] {
  const a = answersByKey(questions, responses);
  const grp = (k: string): Record<string, any> => (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? a[k] : {});
  const out: InternalAlert[] = [];
  const push = (category: string, level: AlertLevel, question_key: string, answer: string, message: string) =>
    out.push({ category, level, question_key, answer, message });

  // Peso
  const wc = grp('mudanca_peso');
  const decreased = typeof wc.mudanca === 'string' && wc.mudanca.startsWith('Diminuiu');
  if (decreased && wc.planejada !== 'Sim') {
    const high = wc.mudanca === 'Diminuiu mais de 5 kg';
    push('Perda de peso não planejada', high ? 'high' : 'attention', 'mudanca_peso', `${wc.mudanca}${wc.planejada ? ` (planejada: ${wc.planejada})` : ''}`,
      high ? 'Redução de mais de 5 kg em três meses sem ter sido planejada.' : 'Perda de peso relatada não planejada.');
  }

  // Sinais dos últimos 3 meses
  const sinais = a['sinais_tres_meses'];
  if (has(sinais, 'Fadiga persistente')) push('Fadiga persistente', 'attention', 'sinais_tres_meses', 'Fadiga persistente', 'Fadiga persistente nos últimos três meses.');
  if (has(sinais, 'Fome muito elevada')) push('Fome muito elevada', 'attention', 'sinais_tres_meses', 'Fome muito elevada', 'Fome muito elevada — avaliar ingestão vs. carga.');
  if (has(sinais, 'Restrição voluntária de carboidratos')) push('Restrição voluntária de carboidratos', 'attention', 'sinais_tres_meses', 'Restrição voluntária de carboidratos', 'Restrição voluntária de carboidratos relatada.');
  if (has(sinais, 'Preocupação excessiva com peso ou alimentos')) push('Preocupação excessiva com peso/alimentos', 'attention', 'sinais_tres_meses', 'Preocupação excessiva com peso ou alimentos', 'Preocupação excessiva com peso ou alimentos.');
  if (hasAny(sinais, ['Dificuldade para manter o ritmo dos treinos', 'Queda de força'])) push('Queda de performance', 'attention', 'sinais_tres_meses', 'Queda de rendimento/força', 'Sinais de queda de performance.');
  if (has(sinais, 'Lesões frequentes')) push('Lesões recorrentes', 'attention', 'sinais_tres_meses', 'Lesões frequentes', 'Lesões frequentes relatadas.');
  if (has(sinais, 'Doenças frequentes')) push('Doenças frequentes', 'attention', 'sinais_tres_meses', 'Doenças frequentes', 'Doenças frequentes relatadas.');

  // Saúde e recuperação
  const saude = grp('saude_recuperacao').situacoes;
  if (has(saude, 'Já tive fratura por estresse')) push('Fratura por estresse', 'high', 'saude_recuperacao', 'Já tive fratura por estresse', 'Histórico de fratura por estresse.');
  if (has(saude, 'Tenho lesões recorrentes')) push('Lesões recorrentes', 'attention', 'saude_recuperacao', 'Tenho lesões recorrentes', 'Lesões recorrentes relatadas.');
  if (has(saude, 'Meu desempenho caiu recentemente')) push('Queda de performance', 'attention', 'saude_recuperacao', 'Meu desempenho caiu recentemente', 'Queda de desempenho recente.');
  if (has(saude, 'Fico doente com frequência')) push('Doenças frequentes', 'attention', 'saude_recuperacao', 'Fico doente com frequência', 'Adoece com frequência.');

  // Ciclo menstrual
  const ciclo = grp('ciclo_menstrual').situacao;
  if (['Irregular', 'Fiquei três meses ou mais sem menstruar', 'A menstruação parou após aumento dos treinos ou perda de peso'].includes(ciclo)) {
    const high = ciclo !== 'Irregular';
    push('Ciclo menstrual irregular ou ausente', high ? 'high' : 'attention', 'ciclo_menstrual', ciclo, 'Alteração do ciclo menstrual — avaliar disponibilidade energética.');
  }

  // Comportamento alimentar
  const fome = grp('fome_comportamento').padroes;
  if (has(fome, 'Tenho episódios de perda de controle')) push('Episódios de perda de controle', 'high', 'fome_comportamento', 'Tenho episódios de perda de controle', 'Episódios de perda de controle alimentar.');
  if (has(fome, 'Evito comer para controlar o peso')) push('Preocupação excessiva com peso/alimentos', 'attention', 'fome_comportamento', 'Evito comer para controlar o peso', 'Evita comer para controlar o peso.');
  if (hasAny(fome, ['Sinto muita fome entre as refeições', 'Sinto muita fome à noite'])) push('Fome muito elevada', 'info', 'fome_comportamento', 'Muita fome relatada', 'Fome elevada relatada no comportamento alimentar.');

  // Diagnósticos
  const diag = grp('diagnosticos_exames').diagnosticos;
  if (has(diag, 'Transtorno alimentar atual ou anterior')) push('Transtorno alimentar atual ou anterior', 'high', 'diagnosticos_exames', 'Transtorno alimentar atual ou anterior', 'Relato de transtorno alimentar atual ou anterior.');

  // Sintomas GI fortes/frequentes
  const gi = a['sintomas_gi'];
  const giDetail: Record<string, any> = gi?.detail || {};
  const strongGi = Object.entries(giDetail).filter(([, d]: any) => d?.intensity === 'Forte' || ['Frequentemente', 'Sempre'].includes(d?.frequency));
  if (strongGi.length) push('Sintomas gastrointestinais fortes ou frequentes', 'attention', 'sintomas_gi', strongGi.map(([s]) => s).join(', '), 'Sintomas GI fortes/frequentes relatados.');

  // Suplemento de ferro sem acompanhamento
  const supItens = grp('suplementos').itens;
  if (has(supItens, 'Ferro')) push('Uso de ferro sem informação de acompanhamento', 'info', 'suplementos', 'Ferro', 'Uso de ferro relatado — confirmar acompanhamento/exames.');

  return out;
}
