// Formatação legível das respostas estruturadas da anamnese
// (refeições com opções/substituições e rotina de treino semanal).

export function isMealObject(v: any): boolean {
  return v && typeof v === 'object' && !Array.isArray(v) && ('itens' in v || 'bebidas' in v || 'horario' in v);
}

// SimpleMeal (Alimentação Habitual v2)
export function isSimpleMealObject(v: any): boolean {
  return v && typeof v === 'object' && !Array.isArray(v) &&
    ('meal_name' in v) && (('options' in v) || ('foods' in v) || ('enabled' in v) || ('skipped' in v));
}
export function isSimpleMealArray(v: any): boolean {
  return Array.isArray(v) && v.length > 0 && v.every(isSimpleMealObject);
}

function foodToString(f: any): string {
  if (!f || typeof f !== 'object') return String(f ?? '').trim();
  const name = String(f.food_name ?? '').trim();
  if (!name) return '';
  const qty = String(f.quantity ?? '').trim();
  const unit = String(f.unit ?? '').trim();
  const qtyUnit = [qty, unit].filter(Boolean).join(' ');
  const base = qtyUnit ? `${name} — ${qtyUnit}` : name;
  const subs = Array.isArray(f.substitutions)
    ? f.substitutions.map((s: any) => String(s ?? '').trim()).filter(Boolean)
    : [];
  return subs.length ? `${base} (ou ${subs.join(' / ')})` : base;
}

export function formatSimpleMeal(v: any): string {
  const name = String(v.meal_name ?? '').trim();
  const time = String(v.time ?? '').trim();
  const header = [name, time].filter(Boolean).join(' — ');
  if (v.skipped || v.enabled === false) {
    return `${header}\n  (não faz essa refeição)`;
  }
  const options: any[] = Array.isArray(v.options) && v.options.length
    ? v.options
    : (Array.isArray(v.foods) ? [{ foods: v.foods }] : []);
  const optLines: string[] = [];
  options.forEach((op, i) => {
    const foods = Array.isArray(op?.foods) ? op.foods : [];
    const items = foods.map(foodToString).filter(Boolean);
    if (!items.length) return;
    if (options.length > 1) optLines.push(`  Opção ${i + 1}:`);
    for (const it of items) optLines.push(options.length > 1 ? `    • ${it}` : `  • ${it}`);
  });
  if (!optLines.length) return `${header}\n  (não respondeu)`;
  return [header, ...optLines].join('\n');
}

export function formatSimpleMealArray(v: any[]): string {
  return v.map(formatSimpleMeal).join('\n\n');
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

// Suporta duas versões do formato da Semana de Treinamento:
// - Antiga: { Segunda: [{modalidade, turno, intensidade, longao}], ... }
// - Nova (ANAMNESE COMPLETA): { Segunda: [{modality, start_time, session_type,
//   duration_minutes, distance_km, rpe, notes}], ..., __planning: {...} }
export function formatTrainingWeek(v: any): string {
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const labelMod: Record<string, string> = {
    repouso: 'Repouso', corrida: 'Corrida', ciclismo: 'Ciclismo', natacao: 'Natação',
    musculacao: 'Musculação', funcional: 'Funcional', triathlon: 'Triathlon', outro: 'Outro',
  };
  const labelTurno: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
  const out: string[] = [];
  for (const dia of dias) {
    const raw = v[dia];
    const sessions = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const lines: string[] = [];
    for (const s of sessions) {
      if (!s || typeof s !== 'object') continue;
      const modRaw = s.modality || s.modalidade;
      if (!modRaw) continue;
      const mod = labelMod[String(modRaw).toLowerCase()] || String(modRaw);
      if (String(modRaw).toLowerCase() === 'repouso') { lines.push(mod); continue; }
      // Novo formato — campos detalhados.
      if ('modality' in s || 'start_time' in s || 'session_type' in s) {
        const bits = [
          s.start_time,
          mod,
          s.session_type,
          s.duration_minutes ? `${s.duration_minutes}min` : null,
          s.distance_km ? `${s.distance_km}km` : null,
          s.rpe ? `RPE ${s.rpe}` : null,
        ].filter(Boolean).join(' · ');
        const notes = s.notes ? ` — ${String(s.notes).trim()}` : '';
        lines.push(bits + notes);
      } else {
        // Formato antigo (modalidade/turno/intensidade/longao)
        const det = [labelTurno[s.turno] || s.turno, s.intensidade].filter(Boolean).join(', ');
        const longao = s.longao ? ' [longão]' : '';
        lines.push(det ? `${mod} (${det})${longao}` : `${mod}${longao}`);
      }
    }
    if (lines.length) out.push(`${dia}:\n  • ${lines.join('\n  • ')}`);
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
  if (isSimpleMealArray(v)) return formatSimpleMealArray(v);
  if (isSimpleMealObject(v)) return formatSimpleMeal(v);
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
    if (isSimpleMealArray(v)) return formatSimpleMealArray(v);
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
