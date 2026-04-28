// NutriPeriodiza — lógica pura de cálculo de fase e progressão intestinal.
// Coexiste em paralelo com a Periodização Metabólica existente.

export type RacePhase = 'base' | 'build' | 'specific' | 'peak' | 'taper' | 'race';

export type DistanceCategory = '5k_10k' | 'half' | 'marathon' | 'ultra';

export interface PhaseInfo {
  phase: RacePhase;
  label: string;
  emoji: string;
  description: string;
  colorClass: string; // tailwind text/bg class
}

export const PHASE_META: Record<RacePhase, PhaseInfo> = {
  base: {
    phase: 'base',
    label: 'Base',
    emoji: '🏗️',
    description: 'Construção da base aeróbica e introdução do treino intestinal.',
    colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  },
  build: {
    phase: 'build',
    label: 'Construção',
    emoji: '📈',
    description: 'Progressão de volume e da taxa de CHO em treinos longos.',
    colorClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
  },
  specific: {
    phase: 'specific',
    label: 'Específica',
    emoji: '🎯',
    description: 'Consolidação do protocolo intra-treino e ratio glicose:frutose.',
    colorClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  peak: {
    phase: 'peak',
    label: 'Pico',
    emoji: '🚀',
    description: 'Máxima taxa intra (60–90 g/h) e ensaio do protocolo de prova.',
    colorClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  },
  taper: {
    phase: 'taper',
    label: 'Taper',
    emoji: '🪶',
    description: 'Polimento, redução de volume e início do carbo-loading.',
    colorClass: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  },
  race: {
    phase: 'race',
    label: 'Competição',
    emoji: '🏁',
    description: 'Semana da prova. Sem testar nada novo.',
    colorClass: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
};

export function calculateWeeksToRace(raceDate: string | Date | null | undefined): number | null {
  if (!raceDate) return null;
  const target = typeof raceDate === 'string' ? new Date(raceDate + 'T00:00:00') : raceDate;
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
}

export function calculatePhase(weeksToRace: number | null): RacePhase | null {
  if (weeksToRace == null) return null;
  if (weeksToRace <= 0) return 'race';
  if (weeksToRace <= 3) return 'taper';
  if (weeksToRace <= 7) return 'peak';
  if (weeksToRace <= 11) return 'specific';
  if (weeksToRace <= 15) return 'build';
  return 'base';
}

export function categorizeDistance(km: number | null | undefined): DistanceCategory | null {
  if (!km || km <= 0) return null;
  if (km <= 10) return '5k_10k';
  if (km < 30) return 'half';
  if (km < 50) return 'marathon';
  return 'ultra';
}

export const DISTANCE_LABEL: Record<DistanceCategory, string> = {
  '5k_10k': '5K–10K',
  half: 'Meia',
  marathon: 'Maratona',
  ultra: 'Ultra',
};

// Defaults estáticos (Fase 1). Na Fase 2 virão de np_protocol_defaults.
export interface PhaseProtocolDefaults {
  cho_daily_range: string;
  gut_training: string;
  pre_training: string;
  intra_training: string;
  carboloading: string;
  carboloading_indicated: boolean;
}

export function getStaticProtocol(phase: RacePhase, distance: DistanceCategory | null): PhaseProtocolDefaults {
  const isShort = distance === '5k_10k';
  const isHalf = distance === 'half';

  const base: Record<RacePhase, PhaseProtocolDefaults> = {
    base: {
      cho_daily_range: '3–5 g/kg/dia',
      gut_training: 'Início — 20–30 g/h em corridas Z2 longas',
      pre_training: '1–4 g/kg, 3–4h antes (treinos chave)',
      intra_training: '0–30 g/h (corridas longas apenas)',
      carboloading: 'Não indicado',
      carboloading_indicated: false,
    },
    build: {
      cho_daily_range: '5–7 g/kg/dia',
      gut_training: 'Progressão — 30–45 g/h em treinos longos',
      pre_training: '1–4 g/kg, 3–4h antes + 0,5 g/kg 30–60 min antes',
      intra_training: '30–45 g/h (treinos acima de 60 min)',
      carboloading: 'Não indicado',
      carboloading_indicated: false,
    },
    specific: {
      cho_daily_range: '6–8 g/kg/dia',
      gut_training: 'Consolidação — 45–60 g/h; ratio glicose:frutose 2:1',
      pre_training: '1–4 g/kg, 3–4h antes + gel 10 min antes em sessões intensas',
      intra_training: '45–60 g/h (sessões acima de 75 min)',
      carboloading: isShort ? 'Não indicado' : 'Ensaio de protocolo 1 vez no ciclo (1–2 dias, 8 g/kg/dia)',
      carboloading_indicated: !isShort,
    },
    peak: {
      cho_daily_range: '7–10 g/kg/dia',
      gut_training: 'Máxima — 60–90 g/h com glicose:frutose 2:1',
      pre_training: 'Protocolo exato de race-day definido e testado',
      intra_training: '60–90 g/h glicose:frutose 2:1',
      carboloading: isShort
        ? 'Não indicado'
        : isHalf
        ? 'Leve (1 dia, 6–8 g/kg) — apenas se Taper/Race'
        : 'Protocolo completo de ensaio (2–3 dias, 8–12 g/kg/dia)',
      carboloading_indicated: !isShort,
    },
    taper: {
      cho_daily_range: '7–10 g/kg/dia (crescente)',
      gut_training: 'Manutenção — 1–2 treinos curtos com CHO',
      pre_training: 'Protocolo definitivo confirmado',
      intra_training: 'Revisão final do protocolo de prova',
      carboloading: isShort
        ? 'Não indicado'
        : isHalf
        ? 'Leve (1 dia, 6–8 g/kg) iniciado 24h antes'
        : 'Iniciar 48–72h antes — moderno (8–10 g/kg × 2–3 dias) ou expresso (10–12 g/kg em 24h)',
      carboloading_indicated: !isShort,
    },
    race: {
      cho_daily_range: '7–10 g/kg/dia',
      gut_training: 'Sem novos estímulos',
      pre_training: '2–4 g/kg, 3–4h antes (IG moderado, baixo resíduo). Gel 10–15 min antes.',
      intra_training: 'Glicose:frutose 2:1, 60–90 g/h — somente o testado',
      carboloading: isShort ? 'Não indicado' : 'Concluído 24–36h antes da largada',
      carboloading_indicated: !isShort,
    },
  };

  return base[phase];
}

export interface GutLog {
  current_cho_rate_g_h: number | null;
  gi_score_global: number | null;
  checkin_date: string;
}

export interface ProgressionSuggestion {
  decision: 'advance' | 'maintain' | 'regress';
  next_cho_rate: number | null;
  reason: string;
}

export function suggestProgression(
  logs: GutLog[],
  phase: RacePhase | null
): ProgressionSuggestion {
  const last = logs[0];
  const prev = logs[1];
  const current = last?.current_cho_rate_g_h ?? 0;

  if (!last) {
    return { decision: 'maintain', next_cho_rate: current, reason: 'Sem registros anteriores.' };
  }

  const lastGI = last.gi_score_global ?? 0;
  const prevGI = prev?.gi_score_global ?? null;

  if (lastGI > 4 || (prevGI != null && prevGI > 4)) {
    return {
      decision: 'regress',
      next_cho_rate: Math.max(20, current - 10),
      reason: `GI Score elevado (último: ${lastGI}/10). Recomenda-se regredir para reduzir sintomas.`,
    };
  }

  if (lastGI <= 3 && prevGI != null && prevGI <= 3) {
    const inc = phase === 'peak' ? 15 : phase === 'taper' ? 0 : 10;
    return {
      decision: inc > 0 ? 'advance' : 'maintain',
      next_cho_rate: current + inc,
      reason:
        inc > 0
          ? `GI Score baixo nos 2 últimos (${prevGI} e ${lastGI}). Avançar +${inc} g/h.`
          : 'Fase Taper — manter taxa atual sem novos estímulos.',
    };
  }

  return {
    decision: 'maintain',
    next_cho_rate: current,
    reason: 'Sintomas moderados ou histórico insuficiente — manter taxa atual.',
  };
}

export function giScoreColorClass(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score <= 3) return 'text-green-500';
  if (score <= 6) return 'text-amber-500';
  return 'text-red-500';
}
