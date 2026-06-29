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

// Retorna a string formatada para respostas estruturadas, ou null se não for um tipo estruturado.
export function formatStructuredAnswer(v: any): string | null {
  if (isMealObject(v)) return formatMeal(v);
  if (isTrainingWeekObject(v)) return formatTrainingWeek(v);
  return null;
}
