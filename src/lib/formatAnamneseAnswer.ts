// Formatação legível das respostas estruturadas da anamnese
// (refeições com opções/substituições e rotina de treino semanal).

export function isMealObject(v: any): boolean {
  return v && typeof v === 'object' && !Array.isArray(v) && ('itens' in v || 'bebidas' in v || 'horario' in v);
}

export function isTrainingWeekObject(v: any): boolean {
  return v && typeof v === 'object' && !Array.isArray(v) && ('Segunda' in v || 'Terça' in v || 'Domingo' in v);
}

// { horario, itens: string[][] | string[], bebidas }
export function formatMeal(v: any): string {
  const lines: string[] = [];
  if (v.horario && String(v.horario).trim()) lines.push(`Horário: ${v.horario}`);
  const itens: any[] = Array.isArray(v.itens) ? v.itens : [];
  const foodLines = itens
    .map((slot: any) => {
      const opts = (Array.isArray(slot) ? slot : [slot])
        .map((o: any) => String(o ?? '').trim())
        .filter(Boolean);
      return opts.join(' ou ');
    })
    .filter(Boolean);
  if (foodLines.length) lines.push(...foodLines.map((f) => `• ${f}`));
  if (v.bebidas && String(v.bebidas).trim()) lines.push(`Bebidas: ${v.bebidas}`);
  return lines.length ? lines.join('\n') : '(não respondeu)';
}

// { Segunda: [{modalidade,turno,intensidade,longao}], ... }
export function formatTrainingWeek(v: any): string {
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const labelMod: Record<string, string> = {
    repouso: 'Repouso', corrida: 'Corrida', ciclismo: 'Ciclismo', natacao: 'Natação',
    musculacao: 'Musculação', funcional: 'Funcional', triathlon: 'Triathlon', outro: 'Outro',
  };
  const labelTurno: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
  const out: string[] = [];
  for (const dia of dias) {
    const sessions = Array.isArray(v[dia]) ? v[dia] : (v[dia] ? [v[dia]] : []);
    const parts = sessions
      .filter((s: any) => s && s.modalidade)
      .map((s: any) => {
        const mod = labelMod[s.modalidade] || s.modalidade;
        if (s.modalidade === 'repouso') return mod;
        const det = [labelTurno[s.turno] || s.turno, s.intensidade].filter(Boolean).join(', ');
        const longao = s.longao ? ' [longão]' : '';
        return det ? `${mod} (${det})${longao}` : `${mod}${longao}`;
      });
    if (parts.length) out.push(`${dia}: ${parts.join(' + ')}`);
  }
  return out.length ? out.join('\n') : '(não respondeu)';
}

// Escala de sintomas: { "Náusea": 3, "Cólica": 0, ... } (nome → nota).
export function isSymptomScaleObject(v: any): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const vals = Object.values(v);
  return vals.length > 0 && vals.every((x) => typeof x === 'number');
}

export function formatSymptomScale(v: Record<string, number>): string {
  const nonZero = Object.entries(v)
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!nonZero.length) return 'Nenhum sintoma relevante relatado (todos 0)';
  return nonZero.map(([k, n]) => `${k}: ${n}`).join('\n');
}

// Retorna a string formatada para respostas estruturadas, ou null se não for um tipo estruturado.
export function formatStructuredAnswer(v: any): string | null {
  if (isMealObject(v)) return formatMeal(v);
  if (isTrainingWeekObject(v)) return formatTrainingWeek(v);
  if (isSymptomScaleObject(v)) return formatSymptomScale(v);
  return null;
}

// Formata QUALQUER resposta de forma legível — nunca retorna "[object Object]".
// Cobre primitivos, arrays (inclusive de objetos) e objetos aninhados, além dos
// tipos estruturados conhecidos (refeição, semana de treino, escala de sintomas).
export function formatAnyAnswer(v: any): string {
  if (v === null || v === undefined || v === '') return '(não respondeu)';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    const s = String(v).trim();
    return s === '' ? '(não respondeu)' : s;
  }
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => (x && typeof x === 'object' ? formatAnyAnswer(x) : String(x ?? '').trim()))
      .filter((s) => s && s !== '(não respondeu)');
    return parts.length ? parts.join(', ') : '(não respondeu)';
  }
  const structured = formatStructuredAnswer(v);
  if (structured) return structured;
  const entries = Object.entries(v).filter(([, val]) => val !== null && val !== undefined && val !== '');
  if (!entries.length) return '(não respondeu)';
  return entries
    .map(([k, val]) => `${k}: ${val && typeof val === 'object' ? formatAnyAnswer(val) : String(val).trim()}`)
    .join('\n');
}
