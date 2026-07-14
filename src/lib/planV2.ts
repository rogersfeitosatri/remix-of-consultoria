// Modelo de plano alimentar v2: 1 plano-base (refeições uma única vez) +
// camadas determinísticas (mapa semanal de treino, carbload, fase da prova,
// orientações por template). A IA gera SÓ o plano-base; todo o calendário e
// carbload é calculado por este código.

export type FuelProfile = 'base' | 'reinforced' | 'quality_session' | 'long_run' | 'carbload' | 'recovery';
export type TrainingType = 'rest' | 'easy' | 'moderate' | 'quality' | 'long_run';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type RacePhase = 'base' | 'build' | 'specific' | 'taper' | 'race_week' | 'post_race' | 'unknown';

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const WEEKDAY_PT: Record<Weekday, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
};
// Mapeia rótulos PT (da anamnese) → weekday en
export const PT_TO_WEEKDAY: Record<string, Weekday> = {
  'segunda': 'monday', 'terça': 'tuesday', 'terca': 'tuesday', 'quarta': 'wednesday',
  'quinta': 'thursday', 'sexta': 'friday', 'sábado': 'saturday', 'sabado': 'saturday', 'domingo': 'sunday',
};

export interface PlanFood { name: string; grams?: number | null; measure?: string | null; }
export interface MealOption { label?: string; foods: PlanFood[]; }
export interface BaseMeal {
  id: string; name: string; defaultTime: string;
  mainOption: MealOption; substitutions: MealOption[]; generalInstructions: string[];
  macros?: { kcal?: number; cho_g?: number; protein_g?: number; fat_g?: number } | null;
}
export interface CarbBlock { id: string; label: string; options: MealOption[]; }
export interface BasePlan {
  planVersion: 2; athleteId?: string; generatedAt?: string;
  meals: BaseMeal[]; carbBlocks: CarbBlock[]; generalInstructions?: string[];
  dailyTargets?: { kcal?: number; cho_g?: number; protein_g?: number; fat_g?: number } | null;
}

export interface MealNote { mealId: string; templateId?: string; text: string; }
export interface WeekDay {
  weekday: Weekday; label: string; trainingType: TrainingType;
  trainingTime?: string | null; durationMinutes?: number | null; intensity?: string | null;
  fuelProfile: FuelProfile; isLongRun: boolean; isCarbload: boolean; isKeySession: boolean;
  mealNotes: MealNote[];
}

export interface CarbloadRules {
  defaultDays: number;
  twoDayDurationThresholdMinutes: number;
  allowTwoDaysDuringSpecificPhase: boolean;
  allowCheckinEscalation: boolean;
}
export const DEFAULT_CARBLOAD_RULES: CarbloadRules = {
  defaultDays: 1, twoDayDurationThresholdMinutes: 150, allowTwoDaysDuringSpecificPhase: true, allowCheckinEscalation: true,
};

export interface PhaseRange { phase: RacePhase; minDays: number; maxDays: number; }
export const DEFAULT_PHASE_RANGES: PhaseRange[] = [
  { phase: 'race_week', minDays: 0, maxDays: 7 },
  { phase: 'taper', minDays: 8, maxDays: 21 },
  { phase: 'specific', minDays: 22, maxDays: 56 },
  { phase: 'build', minDays: 57, maxDays: 120 },
  { phase: 'base', minDays: 121, maxDays: 100000 },
];

// ---------- Determinístico ----------

export function prevWeekday(w: Weekday, back = 1): Weekday {
  const i = WEEKDAYS.indexOf(w);
  return WEEKDAYS[(i - back + 7) % 7];
}

// Dias de carbload a partir do dia do longão (ex.: domingo, 1 dia → [sábado]).
export function computeCarbloadDays(longRunWeekday: Weekday | null, numberOfDays: number): Weekday[] {
  if (!longRunWeekday) return [];
  const n = numberOfDays >= 2 ? 2 : 1;
  const days: Weekday[] = [];
  for (let k = 1; k <= n; k++) days.push(prevWeekday(longRunWeekday, k));
  return days.reverse(); // ordem cronológica
}

// Decide 1 ou 2 dias com base em regras (não é a IA que decide).
export function decideCarbloadDays(
  rules: CarbloadRules,
  ctx: { durationMinutes?: number | null; phase?: RacePhase; escalate?: boolean; block?: boolean },
): { days: number; reasonCodes: string[] } {
  const reasons: string[] = ['DEFAULT_LONG_RUN_PROTOCOL'];
  if (ctx.block) return { days: 1, reasonCodes: ['GI_INTOLERANCE_KEEP_ONE_DAY'] };
  let days = rules.defaultDays >= 2 ? 2 : 1;
  if (rules.twoDayDurationThresholdMinutes && (ctx.durationMinutes ?? 0) >= rules.twoDayDurationThresholdMinutes) {
    days = 2; reasons.push('LONG_DURATION_OVER_THRESHOLD');
  }
  if (rules.allowTwoDaysDuringSpecificPhase && (ctx.phase === 'specific' || ctx.phase === 'taper')) {
    days = 2; reasons.push('SPECIFIC_PHASE');
  }
  if (rules.allowCheckinEscalation && ctx.escalate) { days = 2; reasons.push('CHECKIN_ESCALATION'); }
  return { days, reasonCodes: reasons };
}

export function computePhase(daysToRace: number | null, ranges: PhaseRange[] = DEFAULT_PHASE_RANGES): RacePhase {
  if (daysToRace == null || daysToRace < 0) return 'unknown';
  for (const r of ranges) if (daysToRace >= r.minDays && daysToRace <= r.maxDays) return r.phase;
  return 'unknown';
}

export function daysToRace(raceDate?: string | null, now = new Date()): number | null {
  if (!raceDate) return null;
  const d = new Date(raceDate + (raceDate.length <= 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// Sessão de treino (vinda da anamnese: training_week)
interface RawSession { modalidade?: string; turno?: string; intensidade?: string; longao?: boolean; }

function sessionType(s: RawSession): TrainingType {
  if (!s?.modalidade || s.modalidade === 'repouso') return 'rest';
  if (s.longao) return 'long_run';
  const i = (s.intensidade || '').toLowerCase();
  if (i.includes('intenso')) return 'quality';
  if (i.includes('moderad')) return 'moderate';
  return 'easy';
}
const TURNO_TIME: Record<string, string> = { manha: '06:00', manhã: '06:00', tarde: '16:00', noite: '19:00' };

// Constrói o mapa semanal a partir do treino da anamnese + carbload + fase.
export function buildWeekMap(opts: {
  trainingWeek: Record<string, RawSession[]> | null;
  longRunWeekday: Weekday | null;
  carbloadDays: Weekday[];
  phase: RacePhase;
  baseMealIds: string[];
  resolveNotes: (ctx: { fuelProfile: FuelProfile; trainingType: TrainingType; mealId: string; index: number; total: number; time?: string | null }) => MealNote[];
}): WeekDay[] {
  const { trainingWeek, longRunWeekday, carbloadDays, baseMealIds, resolveNotes } = opts;
  const carbSet = new Set(carbloadDays);
  return WEEKDAYS.map((wd) => {
    const ptKey = Object.keys(trainingWeek || {}).find((k) => PT_TO_WEEKDAY[k.toLowerCase()] === wd);
    const sessions = (ptKey ? (trainingWeek as any)[ptKey] : []) as RawSession[];
    const main = (Array.isArray(sessions) ? sessions : []).filter((s) => s?.modalidade && s.modalidade !== 'repouso');
    const sorted = main.length ? main.map(sessionType).sort(rank) : [];
    const type: TrainingType = sorted.length ? sorted[sorted.length - 1] : 'rest';
    const isLongRun = wd === longRunWeekday || type === 'long_run';
    const isCarbload = carbSet.has(wd);
    const first = main[0];
    const time = first ? (TURNO_TIME[(first.turno || '').toLowerCase()] || null) : null;
    let fuelProfile: FuelProfile = 'base';
    if (isCarbload) fuelProfile = 'carbload';
    else if (isLongRun) fuelProfile = 'long_run';
    else if (type === 'quality') fuelProfile = 'quality_session';
    else if (type === 'rest') fuelProfile = 'recovery';
    else if (type === 'moderate') fuelProfile = 'reinforced';

    const notes: MealNote[] = [];
    baseMealIds.forEach((mealId, index) => {
      const n = resolveNotes({ fuelProfile, trainingType: type, mealId, index, total: baseMealIds.length, time });
      for (const x of n) { if (notes.filter((z) => z.mealId === mealId).length < 2) notes.push(x); }
    });
    // no máximo 3 refeições destacadas por dia
    const highlighted = new Set<string>();
    const capped: MealNote[] = [];
    for (const n of notes) {
      if (!highlighted.has(n.mealId) && highlighted.size >= 3) continue;
      highlighted.add(n.mealId); capped.push(n);
    }
    return {
      weekday: wd, label: WEEKDAY_PT[wd], trainingType: type, trainingTime: time,
      durationMinutes: null, intensity: first?.intensidade ?? null,
      fuelProfile, isLongRun, isCarbload, isKeySession: type === 'quality' || isLongRun,
      mealNotes: capped,
    };
  });
}

function rank(a: TrainingType, b: TrainingType): number {
  const order: TrainingType[] = ['rest', 'easy', 'moderate', 'quality', 'long_run'];
  return order.indexOf(a) - order.indexOf(b);
}

// Etiqueta curta por dia (para a tela "Minha semana")
export function dayLabel(day: WeekDay): string {
  if (day.isCarbload) return 'Preparação para o longão';
  if (day.isLongRun) return 'Longão';
  if (day.trainingType === 'quality') return 'Treino de qualidade';
  if (day.trainingType === 'rest') return 'Recuperação';
  return 'Dia-base';
}

// ---------- Biblioteca de templates de orientação (curtas, sem IA) ----------
export interface OrientationTemplate {
  id: string; fuelProfile?: FuelProfile; trainingType?: TrainingType;
  slot: 'first' | 'mid' | 'last' | 'any'; text: string;
}
// Máx. ~220 caracteres por orientação. IDs estáveis (administráveis no futuro).
export const ORIENTATION_TEMPLATES: OrientationTemplate[] = [
  { id: 'CARBLOAD_FIRST', fuelProfile: 'carbload', slot: 'first', text: 'Hoje começa a preparação para o longão. Use a opção completa de carboidrato desta refeição e evite testar alimentos novos.' },
  { id: 'CARBLOAD_MID', fuelProfile: 'carbload', slot: 'mid', text: 'Dia de reforço de carboidrato. Priorize a opção completa desta refeição para chegar bem abastecido no longão.' },
  { id: 'CARBLOAD_GI', fuelProfile: 'carbload', slot: 'last', text: 'Se sentir o estômago muito cheio, distribua esta refeição em duas etapas e prefira opções de digestão mais fácil.' },
  { id: 'LONGRUN_FIRST', fuelProfile: 'long_run', slot: 'first', text: 'Dia de longão. Capriche no café da manhã com a opção completa de carboidrato de fácil digestão já prevista no plano.' },
  { id: 'LONGRUN_POST', fuelProfile: 'long_run', slot: 'mid', text: 'Após o longão, priorize carboidrato + proteína para recuperar. Se terminar com fome intensa ou queda de rendimento, informe no check-in.' },
  { id: 'QUALITY_FIRST', fuelProfile: 'quality_session', slot: 'first', text: 'Hoje o treino é mais intenso. Priorize a opção completa de carboidrato desta refeição para render bem.' },
  { id: 'QUALITY_CHECKIN', fuelProfile: 'quality_session', slot: 'last', text: 'Se perceber queda de energia no treino, registre isso no próximo check-in para ajustarmos.' },
  { id: 'REINFORCED_FIRST', fuelProfile: 'reinforced', slot: 'first', text: 'Treino moderado hoje. Siga as quantidades do plano, mantendo o carboidrato desta refeição.' },
  { id: 'RECOVERY_FIRST', fuelProfile: 'recovery', slot: 'first', text: 'Dia leve/de recuperação. Siga normalmente as quantidades do plano-base.' },
  { id: 'BASE_FIRST', fuelProfile: 'base', slot: 'first', text: 'Treino leve hoje. Siga as quantidades normais do plano-base.' },
];

// Resolvedor padrão: escolhe orientações por perfil de combustível e posição da
// refeição (primeira / meio / última). Não chama IA.
export function defaultResolveNotes(ctx: {
  fuelProfile: FuelProfile; trainingType: TrainingType; mealId: string; index: number; total: number; time?: string | null;
}): MealNote[] {
  const slot: 'first' | 'mid' | 'last' = ctx.index === 0 ? 'first' : ctx.index >= ctx.total - 1 ? 'last' : 'mid';
  const midIndex = Math.floor(ctx.total / 2);
  const isMidMeal = ctx.index === midIndex;
  const out: MealNote[] = [];
  for (const t of ORIENTATION_TEMPLATES) {
    if (t.fuelProfile && t.fuelProfile !== ctx.fuelProfile) continue;
    const slotOk = t.slot === 'any' || t.slot === slot || (t.slot === 'mid' && isMidMeal);
    if (!slotOk) continue;
    out.push({ mealId: ctx.mealId, templateId: t.id, text: t.text });
  }
  return out.slice(0, 2);
}

// Monta a visão de um dia: refeições do plano-base + notas do dia.
export function buildDayView(base: BasePlan, day: WeekDay) {
  const noteByMeal: Record<string, MealNote[]> = {};
  for (const n of day.mealNotes) (noteByMeal[n.mealId] ||= []).push(n);
  return {
    day,
    meals: base.meals.map((m) => ({ meal: m, notes: noteByMeal[m.id] || [] })),
  };
}

// ---------- Composer: transforma o plano v2 armazenado na visão completa ----------
export interface PlanPatch {
  createdAt: string;
  signals: string[];
  carbloadChange?: { fromDays: number; toDays: number; reasonCodes: string[] } | null;
  summaryForAthlete: string;
  professionalReviewRequired: boolean;
  newMealNotes?: MealNote[];
}

export interface PlanV2Stored {
  planModelVersion: 2;
  basePlan: BasePlan;
  inputs: {
    longRunWeekday?: Weekday | null;
    trainingWeek?: Record<string, any> | null; // training_week da anamnese (chaves PT)
    raceDate?: string | null;
  };
  carbloadRules?: Partial<CarbloadRules>;
  carbloadOverride?: { numberOfDays?: number; reasonCodes?: string[] } | null; // vindo do check-in
  patches?: PlanPatch[];
  planVersionNumber?: number;
  status?: string;
  generatedAt?: string;
}

export interface CarbloadProtocol {
  longRunWeekday: Weekday | null;
  numberOfDays: number;
  appliesOn: Weekday[];
  reasonCodes: string[];
}

export interface PlanV2View {
  basePlan: BasePlan;
  weekMap: WeekDay[];
  phase: RacePhase;
  daysToRace: number | null;
  carbload: CarbloadProtocol;
  todayWeekday: Weekday;
}

export function todayWeekday(now = new Date()): Weekday {
  return WEEKDAYS[(now.getDay() + 6) % 7]; // getDay(): 0=domingo
}

export function buildPlanV2View(stored: PlanV2Stored, opts?: { escalate?: boolean; block?: boolean; now?: Date }): PlanV2View {
  const now = opts?.now ?? new Date();
  const rules: CarbloadRules = { ...DEFAULT_CARBLOAD_RULES, ...(stored.carbloadRules || {}) };
  const longRun = stored.inputs?.longRunWeekday ?? null;
  const dtr = daysToRace(stored.inputs?.raceDate, now);
  const phase = computePhase(dtr);
  const decision = decideCarbloadDays(rules, { phase, escalate: opts?.escalate, block: opts?.block });
  // O check-in pode ter definido um override (ex.: escalou para 2 dias).
  const overrideDays = stored.carbloadOverride?.numberOfDays;
  const effectiveDays = overrideDays === 1 || overrideDays === 2 ? overrideDays : decision.days;
  const reasonCodes = overrideDays ? (stored.carbloadOverride?.reasonCodes || ['CHECKIN_OVERRIDE']) : decision.reasonCodes;
  const appliesOn = computeCarbloadDays(longRun, effectiveDays);
  const baseMealIds = (stored.basePlan?.meals || []).map((m) => m.id);
  const weekMap = buildWeekMap({
    trainingWeek: stored.inputs?.trainingWeek ?? null,
    longRunWeekday: longRun,
    carbloadDays: appliesOn,
    phase,
    baseMealIds,
    resolveNotes: defaultResolveNotes,
  });
  return {
    basePlan: stored.basePlan,
    weekMap,
    phase,
    daysToRace: dtr,
    carbload: { longRunWeekday: longRun, numberOfDays: effectiveDays, appliesOn, reasonCodes },
    todayWeekday: todayWeekday(now),
  };
}
